import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import crypto from "node:crypto";
import mongoose from "mongoose";
import { enqueueCustomerDeliveries } from "./notificationDeliveryService.js";
import {
  getEmailTransportErrorDetails,
  renderBrandedEmail,
  sendTransactionalEmail,
} from "./emailService.js";

import User from "../models/User.js";
import RefreshToken from "../models/RefreshToken.js";
import OTPVerification from "../models/OTPVerification.js";
import PasswordResetToken from "../models/PasswordResetToken.js";

const ACCESS_TOKEN_TTL =
  process.env.JWT_ACCESS_EXPIRES_IN || "15m";

const REFRESH_TOKEN_DAYS = Number(
  process.env.JWT_REFRESH_EXPIRES_IN?.replace("d", "") || 7
);
const OTP_TTL_MS = 10 * 60 * 1000;
const PASSWORD_RESET_TTL_MS = 15 * 60 * 1000;
const MAX_OTP_ATTEMPTS = 5;

const hashToken = (token) =>
  crypto.createHash("sha256").update(token).digest("hex");

const hashOtp = (challengeId, purpose, otp) => {
  const secret = process.env.JWT_ACCESS_SECRET;
  if (!secret) {
    throw new Error("JWT_ACCESS_SECRET is missing");
  }
  return crypto
    .createHmac("sha256", secret)
    .update(`${challengeId}:${purpose}:${otp}`)
    .digest("hex");
};

const createError = (message, statusCode) => {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
};

const createOtpChallenge = async ({ user = null, email, purpose }) => {
  if (user) {
    await OTPVerification.updateMany(
      {
        user: user._id,
        purpose,
        verifiedAt: null,
        consumedAt: null,
        revokedAt: null,
      },
      { $set: { revokedAt: new Date() } }
    );
  }

  const otp = crypto.randomInt(0, 1_000_000).toString().padStart(6, "0");
  const challengeId = new mongoose.Types.ObjectId();
  await OTPVerification.create({
    _id: challengeId,
    user: user?._id ?? null,
    purpose,
    channel: "email",
    destination: email,
    otpHash: hashOtp(challengeId, purpose, otp),
    expiresAt: new Date(Date.now() + OTP_TTL_MS),
    maxAttempts: MAX_OTP_ATTEMPTS,
  });

  if (user) {
    try {
      const subject =
        purpose === "password_reset"
          ? "Reset your Nishree Attire password"
          : purpose === "email_verification"
            ? "Verify your Nishree Attire email"
            : "Your Nishree Attire sign-in code";
      const text = `Your Nishree Attire verification code is ${otp}. It expires in 10 minutes. Never share this code with anyone. If you did not request this code, you can ignore this email.`;
      await sendTransactionalEmail({
        to: email,
        subject,
        text,
        html: renderBrandedEmail({
          title: purpose === "password_reset"
            ? "Reset your password"
            : purpose === "email_verification"
              ? "Verify your email address"
              : "Sign in securely",
          preheader: "Your secure Nishree Attire verification code.",
          body: "Enter this code to continue. It expires in 10 minutes.",
          otp,
        }),
      });
    } catch (error) {
      await OTPVerification.updateOne(
        { _id: challengeId, consumedAt: null },
        { $set: { revokedAt: new Date() } }
      );
      const deliveryError = createError(
        "Verification code email could not be sent. Please try again later.",
        503
      );
      deliveryError.code = "OTP_EMAIL_DELIVERY_FAILED";
      deliveryError.cause = error;
      throw deliveryError;
    }
  }

  return String(challengeId);
};

const claimOtpChallenge = async ({ challengeId, otp, purpose }) => {
  if (!mongoose.isValidObjectId(challengeId) || !/^\d{6}$/.test(otp)) {
    throw createError("The verification code is invalid or has expired.", 400);
  }

  const now = new Date();
  const challenge = await OTPVerification.findOne({
    _id: challengeId,
    purpose,
    expiresAt: { $gt: now },
    verifiedAt: null,
    consumedAt: null,
    revokedAt: null,
    attempts: { $lt: MAX_OTP_ATTEMPTS },
  }).select("+otpHash");

  if (!challenge) {
    throw createError("The verification code is invalid or has expired.", 400);
  }

  const expectedHash = Buffer.from(challenge.otpHash, "hex");
  const providedHash = Buffer.from(hashOtp(challenge._id, purpose, otp), "hex");
  const isValid =
    expectedHash.length === providedHash.length &&
    crypto.timingSafeEqual(expectedHash, providedHash);
  const filter = {
    _id: challenge._id,
    purpose,
    expiresAt: { $gt: now },
    verifiedAt: null,
    consumedAt: null,
    revokedAt: null,
    attempts: challenge.attempts,
  };

  if (!isValid) {
    await OTPVerification.findOneAndUpdate(
      filter,
      { $inc: { attempts: 1 } },
      { returnDocument: "after" }
    );
    throw createError("The verification code is invalid or has expired.", 400);
  }

  const verified = await OTPVerification.findOneAndUpdate(
    filter,
    {
      $set:
        purpose === "password_reset"
          ? { verifiedAt: now }
          : { consumedAt: now },
      $inc: { attempts: 1 },
    },
    { returnDocument: "after" }
  );

  if (!verified) {
    throw createError("The verification code is invalid or has expired.", 400);
  }

  return verified;
};

const createAccessToken = (user) => {
  const secret = process.env.JWT_ACCESS_SECRET;

  if (!secret) {
    throw new Error("JWT_ACCESS_SECRET is missing");
  }

  return jwt.sign(
    {
      sub: String(user._id),
      accountType: "user",
    },
    secret,
    {
      expiresIn: ACCESS_TOKEN_TTL,
      issuer: "nishree-attaire-api",
      audience: "nishree-attaire-client",
    }
  );
};

const createSession = async (user) => {

  const refreshToken = crypto.randomBytes(48).toString("hex");
  const expiresAt = new Date(
    Date.now() + REFRESH_TOKEN_DAYS * 24 * 60 * 60 * 1000
  );

  await RefreshToken.create({
    user: user._id,
    tokenHash: hashToken(refreshToken),
    expiresAt,
    otpVerifiedAt: new Date(),
  });

  return {
    accessToken: createAccessToken(user),
    refreshToken,
  };
};

const publicUser = (user) => ({
  id: String(user._id),
  name: user.name,
  email: user.email,
  phone: user.phone,
  status: user.status,
  profileImage: user.profileImage?.url || "",
});


export const registerUser = async ({ name, email, phone, password }) => {
  const existingUser = await User.findOne({ email });

  if (existingUser) {
    const error = new Error("An account with this email already exists");
    error.statusCode = 409;
    throw error;
  }

  const passwordHash = await bcrypt.hash(password, 12);

  const user = await User.create({
    name,
    email,
    phone,
    passwordHash,
    isEmailVerified: false,
  });

  const challengeId = await createOtpChallenge({
    user,
    email: user.email,
    purpose: "email_verification",
  });

  try {
    await enqueueCustomerDeliveries({
      userId: user._id,
      eventType: "welcome",
      deliveryKey: `welcome:${user._id}`,
      title: `Welcome to ${process.env.STORE_NAME || "Nishree Attire"}`,
      message:
        "Your account has been created successfully. We are glad to have you with us.",
    });
  } catch (error) {
    console.error("Welcome email enqueue failed:", error.message);
  }

  return {
    user: publicUser(user),
    challengeId,
    otpRequired: true,
  };
};


export const loginUser = async ({ email, password }) => {
  const user = await User.findOne({ email }).select("+passwordHash");

  if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
    const error = new Error("Invalid email or password");
    error.statusCode = 401;
    throw error;
  }

  if (user.status && user.status !== "active") {
    const error = new Error("This account is not active");
    error.statusCode = 403;
    throw error;
  }

  return {
    challengeId: await createOtpChallenge({
      user,
      email: user.email,
      purpose: "login",
    }),
    otpRequired: true,
  };
};

export const verifyUserLogin = async ({ challengeId, otp }) => {
  const challenge = await claimOtpChallenge({
    challengeId,
    otp,
    purpose: "login",
  });
  return establishUserSession(challenge.user);
};

export const verifyUserEmail = async ({ challengeId, otp }) => {
  const challenge = await claimOtpChallenge({
    challengeId,
    otp,
    purpose: "email_verification",
  });
  return establishUserSession(challenge.user);
};

const establishUserSession = async (userId) => {
  const user = await User.findById(userId).select("+passwordHash");
  if (!user || (user.status && user.status !== "active")) {
    throw createError("Account is not available.", 401);
  }

  user.isEmailVerified = true;
  user.lastLoginAt = new Date();
  await user.save();

  const session = await createSession(user);
  return { user: publicUser(user), ...session };
};

export const requestPasswordReset = async (email) => {
  const user = await User.findOne({ email });
  const challengeId = await createOtpChallenge({
    user: user?.status === "active" ? user : null,
    email,
    purpose: "password_reset",
  });
  return { challengeId };
};

export const verifyPasswordResetOtp = async ({ challengeId, otp }) => {
  const challenge = await claimOtpChallenge({
    challengeId,
    otp,
    purpose: "password_reset",
  });
  if (!challenge.user) {
    throw createError("The verification code is invalid or has expired.", 400);
  }

  await PasswordResetToken.updateMany(
    {
      user: challenge.user,
      usedAt: null,
      revokedAt: null,
    },
    { $set: { revokedAt: new Date() } }
  );
  const resetToken = crypto.randomBytes(32).toString("hex");
  await PasswordResetToken.create({
    user: challenge.user,
    tokenHash: hashToken(resetToken),
    expiresAt: new Date(Date.now() + PASSWORD_RESET_TTL_MS),
  });
  return { resetToken };
};

export const resetUserPassword = async ({ resetToken, password }) => {
  const tokenHash = hashToken(resetToken);
  const token = await PasswordResetToken.findOneAndUpdate(
    {
      tokenHash,
      usedAt: null,
      revokedAt: null,
      expiresAt: { $gt: new Date() },
    },
    { $set: { usedAt: new Date() } },
    { returnDocument: "after" }
  );
  if (!token) {
    throw createError("The password reset link is invalid or has expired.", 400);
  }

  const passwordHash = await bcrypt.hash(password, 12);
  const user = await User.findOneAndUpdate(
    { _id: token.user, status: "active" },
    { $set: { passwordHash } },
    { returnDocument: "after" }
  );
  if (!user) {
    throw createError("Account is not available.", 401);
  }
  await RefreshToken.updateMany(
    { user: user._id, revokedAt: null },
    { $set: { revokedAt: new Date() } }
  );
  let emailSent = true;
  try {
    const subject = "Your Nishree Attire password was changed";
    const text = "Your account password has been changed. If you did not make this change, contact Nishree Attire support immediately.";
    await sendTransactionalEmail({
      to: user.email,
      subject,
      text,
      html: renderBrandedEmail({
        title: "Password updated",
        preheader: "Your Nishree Attire account password has changed.",
        body: text,
      }),
    });
  } catch (error) {
    emailSent = false;
    console.error(
      "Password reset confirmation email failed:",
      getEmailTransportErrorDetails(error)
    );
  }
  return { success: true, emailSent };
};

export const refreshUserSession = async (rawRefreshToken) => {
  if (!rawRefreshToken) {
    const error = new Error("Refresh token is invalid or expired");
    error.statusCode = 401;
    throw error;
  }

  const tokenHash = hashToken(rawRefreshToken);

  const storedToken = await RefreshToken.findOne({
    tokenHash,
    revokedAt: null,
    expiresAt: { $gt: new Date() },
    user: { $ne: null },
    otpVerifiedAt: { $ne: null },
  });

  if (!storedToken) {
    const error = new Error("Refresh token is invalid or expired");
    error.statusCode = 401;
    throw error;
  }

  const user = await User.findById(storedToken.user);

  if (!user || (user.status && user.status !== "active")) {
    const error = new Error("Account is not available");
    error.statusCode = 401;
    throw error;
  }

  const nextRefreshToken = crypto.randomBytes(48).toString("hex");
  const nextHash = hashToken(nextRefreshToken);
  const nextExpiresAt = new Date(
    Date.now() + REFRESH_TOKEN_DAYS * 24 * 60 * 60 * 1000
  );

  // Atomic revoke prevents the same refresh token being rotated twice.
  const revokedToken = await RefreshToken.findOneAndUpdate(
    {
      _id: storedToken._id,
      revokedAt: null,
      expiresAt: { $gt: new Date() },
    },
    {
      $set: {
        revokedAt: new Date(),
        replacedByTokenHash: nextHash,
      },
    },
    { returnDocument: "after" }
  );

  if (!revokedToken) {
    const error = new Error("Refresh token has already been used");
    error.statusCode = 401;
    throw error;
  }

  try {
    await RefreshToken.create({
      user: user._id,
      tokenHash: nextHash,
      expiresAt: nextExpiresAt,
      otpVerifiedAt: storedToken.otpVerifiedAt,
    });
  } catch (error) {
    // Do not restore the old token if rotation fails.
    throw error;
  }

  return {
    user: publicUser(user),
    accessToken: createAccessToken(user),
    refreshToken: nextRefreshToken,
  };
};

export const logoutUser = async (rawRefreshToken) => {
  if (!rawRefreshToken) return;

  await RefreshToken.updateOne(
    {
      tokenHash: hashToken(rawRefreshToken),
      revokedAt: null,
    },
    {
      $set: { revokedAt: new Date() },
    }
  );
};
