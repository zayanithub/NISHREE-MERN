import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import crypto from "node:crypto";
import mongoose from "mongoose";

import AdminUser from "../models/AdminUser.js";
import RefreshToken from "../models/RefreshToken.js";
import OTPVerification from "../models/OTPVerification.js";

import "../models/Role.js";
import "../models/Permission.js";
import { sendVerificationCodeEmail } from "./emailService.js";

const ACCESS_TOKEN_TTL =
  process.env.JWT_ACCESS_EXPIRES_IN || "15m";

const REFRESH_TOKEN_DAYS = Number(
  process.env.JWT_REFRESH_EXPIRES_IN?.replace("d", "") || 7
);

const JWT_ISSUER = "nishree-attaire-api";
const JWT_AUDIENCE = "nishree-attaire-client";
const OTP_TTL_MS = 10 * 60 * 1000;
const OTP_RESEND_COOLDOWN_MS = 60 * 1000;
const MAX_OTP_ATTEMPTS = 5;

const hashToken = (token) =>
  crypto.createHash("sha256").update(token).digest("hex");

const hashOtp = (challengeId, otp) => {
  const secret = process.env.JWT_ACCESS_SECRET;
  if (!secret) {
    throw new Error("JWT_ACCESS_SECRET is missing");
  }
  return crypto
    .createHmac("sha256", secret)
    .update(`${challengeId}:admin_login:${otp}`)
    .digest("hex");
};

const createError = (message, statusCode) => {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
};

const hasActiveRole = (admin) =>
  Boolean(admin?.role && admin.role.isActive === true);

const maskEmail = (email) => {
  const [localPart, domain] = String(email).split("@");
  if (!localPart || !domain) return "invalid";
  return `${localPart[0]}***@${domain}`;
};

const normalizeOtpDeliveryError = (error) => {
  error.statusCode = 503;
  error.message = error.code === "RESEND_CONFIG_MISSING"
    ? "Admin OTP email delivery is not configured."
    : "Admin OTP email could not be delivered. Please try again.";
  return error;
};

/*
|--------------------------------------------------------------------------
| Public Admin
|--------------------------------------------------------------------------
*/

const publicAdmin = (admin) => ({
  id: String(admin._id),
  name: admin.name,
  email: admin.email,
  status: admin.status,
  isEmailVerified: admin.isEmailVerified,
  role: admin.role
    ? {
        id: String(admin.role._id),
        name: admin.role.name,
        permissions: admin.role.permissions || [],
      }
    : null,
});

/*
|--------------------------------------------------------------------------
| Access Token
|--------------------------------------------------------------------------
*/

const createAccessToken = (admin) => {
  const secret = process.env.JWT_ACCESS_SECRET;

  if (!secret) {
    throw new Error("JWT_ACCESS_SECRET is missing");
  }

  return jwt.sign(
    {
      sub: String(admin._id),
      accountType: "admin",
    },
    secret,
    {
      expiresIn: ACCESS_TOKEN_TTL,
      issuer: JWT_ISSUER,
      audience: JWT_AUDIENCE,
    }
  );
};

/*
|--------------------------------------------------------------------------
| Refresh Session
|--------------------------------------------------------------------------
*/

const createSession = async (admin) => {
  const refreshToken = crypto.randomBytes(48).toString("hex");

  const expiresAt = new Date(
    Date.now() +
      REFRESH_TOKEN_DAYS * 24 * 60 * 60 * 1000
  );

  await RefreshToken.create({
    adminUser: admin._id,
    tokenHash: hashToken(refreshToken),
    expiresAt,
    otpVerifiedAt: new Date(),
  });

  return {
    accessToken: createAccessToken(admin),
    refreshToken,
  };
};

/*
|--------------------------------------------------------------------------
| Login
|--------------------------------------------------------------------------
*/

const validateAdminCredentials = async ({ email, password }) => {
  const admin = await AdminUser.findOne({ email })
    .select("+passwordHash")
    .populate({
      path: "role",
      select: "name isActive permissions",
      populate: {
        path: "permissions",
        select: "name resource action description",
      },
    });

  if (!admin) {
    const error = new Error("Invalid email or password");
    error.statusCode = 401;
    throw error;
  }

  const passwordValid = await bcrypt.compare(
    password,
    admin.passwordHash
  );

  if (!passwordValid) {
    const error = new Error("Invalid email or password");
    error.statusCode = 401;
    throw error;
  }

  if (admin.status !== "active") {
    const error = new Error(
      "This admin account is not active"
    );
    error.statusCode = 403;
    throw error;
  }

  if (!hasActiveRole(admin)) {
    throw createError("This admin account does not have an active role.", 403);
  }

  return admin;
};

const deliverAdminLoginOtp = async (email, otp, challengeId) => {
  const text = `Your Nishree Attire admin verification code is ${otp}. It expires in 10 minutes. Never share this code with anyone. If you did not request this code, secure your admin account immediately.`;
  return sendVerificationCodeEmail({
    to: email,
    otp,
    purpose: "admin_login",
    challengeId,
    otpHash: hashOtp(challengeId, otp),
    subject: "Your Nishree Attire admin sign-in code",
    text,
    title: "Verify your admin sign-in",
    preheader: "Your secure Nishree Attire admin verification code.",
    body: "Enter this code to finish signing in to the admin portal. It expires in 10 minutes.",
  });
};

export const loginAdmin = async (credentials) => {
  const admin = await validateAdminCredentials(credentials);
  await OTPVerification.updateMany(
    {
      adminUser: admin._id,
      purpose: "admin_login",
      verifiedAt: null,
      consumedAt: null,
      revokedAt: null,
    },
    { $set: { revokedAt: new Date() } }
  );

  const otp = crypto.randomInt(0, 1_000_000).toString().padStart(6, "0");
  const challengeId = new mongoose.Types.ObjectId();
  await OTPVerification.create({
    _id: challengeId,
    adminUser: admin._id,
    purpose: "admin_login",
    channel: "email",
    destination: admin.email,
    otpHash: hashOtp(challengeId, otp),
    expiresAt: new Date(Date.now() + OTP_TTL_MS),
    maxAttempts: MAX_OTP_ATTEMPTS,
  });

  try {
    const delivery = await deliverAdminLoginOtp(
      admin.email,
      otp,
      challengeId
    );
    console.info(JSON.stringify({
      event: "admin.otp.email.accepted",
      challengeId: String(challengeId),
      messageId: delivery.messageId,
      destination: maskEmail(admin.email),
    }));
  } catch (error) {
    await OTPVerification.updateOne(
      { _id: challengeId, consumedAt: null },
      { $set: { revokedAt: new Date() } }
    );
    throw normalizeOtpDeliveryError(error);
  }

  return {
    otpRequired: true,
    challengeId: String(challengeId),
    email: admin.email,
  };
};

export const resendAdminLoginOtp = async ({ challengeId }) => {
  if (!mongoose.isValidObjectId(challengeId)) {
    throw createError("The verification request is invalid or has expired.", 400);
  }

  const now = new Date();
  const challenge = await OTPVerification.findOne({
    _id: challengeId,
    purpose: "admin_login",
    expiresAt: { $gt: now },
    verifiedAt: null,
    consumedAt: null,
    revokedAt: null,
    attempts: { $lt: MAX_OTP_ATTEMPTS },
  });
  if (!challenge) {
    throw createError("The verification request is invalid or has expired.", 400);
  }
  if (now.getTime() - challenge.updatedAt.getTime() < OTP_RESEND_COOLDOWN_MS) {
    throw createError("Please wait before requesting another code.", 429);
  }

  const admin = await AdminUser.findById(challenge.adminUser).populate({
    path: "role",
    populate: {
      path: "permissions",
      select: "name resource action description",
    },
  });
  if (!admin || admin.status !== "active" || !hasActiveRole(admin)) {
    throw createError("This admin account is not available.", 403);
  }

  const otp = crypto.randomInt(0, 1_000_000).toString().padStart(6, "0");
  const updated = await OTPVerification.findOneAndUpdate(
    {
      _id: challenge._id,
      purpose: "admin_login",
      expiresAt: { $gt: now },
      verifiedAt: null,
      consumedAt: null,
      revokedAt: null,
      attempts: challenge.attempts,
      updatedAt: challenge.updatedAt,
    },
    {
      $set: {
        otpHash: hashOtp(challenge._id, otp),
        expiresAt: new Date(Date.now() + OTP_TTL_MS),
        attempts: 0,
        updatedAt: now,
      },
    },
    { returnDocument: "after" }
  );
  if (!updated) {
    throw createError("The verification request is invalid or has expired.", 400);
  }

  try {
    const delivery = await deliverAdminLoginOtp(
      admin.email,
      otp,
      challenge._id
    );
    console.info(JSON.stringify({
      event: "admin.otp.email.accepted",
      challengeId: String(challenge._id),
      messageId: delivery.messageId,
      destination: maskEmail(admin.email),
      resend: true,
    }));
  } catch (error) {
    await OTPVerification.updateOne(
      { _id: challenge._id, consumedAt: null },
      { $set: { revokedAt: new Date() } }
    );
    throw normalizeOtpDeliveryError(error);
  }

  return { otpRequired: true, challengeId: String(challenge._id), email: admin.email };
};

export const verifyAdminLoginOtp = async ({ challengeId, otp }) => {
  if (!mongoose.isValidObjectId(challengeId) || !/^\d{6}$/.test(otp)) {
    throw createError("The verification code is invalid or has expired.", 400);
  }

  const now = new Date();
  const challenge = await OTPVerification.findOne({
    _id: challengeId,
    purpose: "admin_login",
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
  const providedHash = Buffer.from(hashOtp(challenge._id, otp), "hex");
  const isValid =
    expectedHash.length === providedHash.length &&
    crypto.timingSafeEqual(expectedHash, providedHash);
  const filter = {
    _id: challenge._id,
    purpose: "admin_login",
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

  const consumed = await OTPVerification.findOneAndUpdate(
    filter,
    { $set: { verifiedAt: now, consumedAt: now } },
    { returnDocument: "after" }
  );
  if (!consumed) {
    throw createError("The verification code is invalid or has expired.", 400);
  }

  const admin = await AdminUser.findById(challenge.adminUser).populate({
    path: "role",
    populate: {
      path: "permissions",
      select: "name resource action description",
    },
  });
  if (!admin || admin.status !== "active" || !hasActiveRole(admin)) {
    throw createError("This admin account is not available.", 403);
  }

  admin.lastLoginAt = now;
  await admin.save();
  const session = await createSession(admin);
  return { admin: publicAdmin(admin), ...session };
};

/*
|--------------------------------------------------------------------------
| Refresh Admin Session
|--------------------------------------------------------------------------
*/

export const refreshAdminSession = async (
  rawRefreshToken
) => {
  if (!rawRefreshToken) {
    const error = new Error(
      "Refresh token is invalid or expired"
    );
    error.statusCode = 401;
    throw error;
  }

  const tokenHash = hashToken(rawRefreshToken);

  const storedToken = await RefreshToken.findOne({
    tokenHash,
    adminUser: { $ne: null },
    otpVerifiedAt: { $type: "date" },
    revokedAt: null,
    expiresAt: {
      $gt: new Date(),
    },
  });

  if (!storedToken) {
    const error = new Error(
      "Refresh token is invalid or expired"
    );
    error.statusCode = 401;
    throw error;
  }

  const admin = await AdminUser.findById(
    storedToken.adminUser
  ).populate({
    path: "role",
    populate: {
      path: "permissions",
      select: "name resource action description",
    },
  });

  if (!admin || admin.status !== "active" || !hasActiveRole(admin)) {
    const error = new Error(
      "Admin account is not available"
    );
    error.statusCode = 401;
    throw error;
  }

  /*
   * Generate replacement refresh token
   */

  const nextRefreshToken = crypto.randomBytes(48).toString(
    "hex"
  );

  const nextHash = hashToken(nextRefreshToken);

  const nextExpiresAt = new Date(
    Date.now() +
      REFRESH_TOKEN_DAYS * 24 * 60 * 60 * 1000
  );

  /*
   * Atomic rotation
   */

  const revokedToken =
    await RefreshToken.findOneAndUpdate(
      {
        _id: storedToken._id,
        revokedAt: null,
        expiresAt: {
          $gt: new Date(),
        },
      },
      {
        $set: {
          revokedAt: new Date(),
          replacedByTokenHash: nextHash,
        },
      },
      {
        returnDocument: "after",
      }
    );

  if (!revokedToken) {
    const error = new Error(
      "Refresh token has already been used"
    );
    error.statusCode = 401;
    throw error;
  }

  await RefreshToken.create({
    adminUser: admin._id,
    tokenHash: nextHash,
    expiresAt: nextExpiresAt,
    otpVerifiedAt: storedToken.otpVerifiedAt,
  });

  return {
    admin: publicAdmin(admin),
    accessToken: createAccessToken(admin),
    refreshToken: nextRefreshToken,
  };
};

/*
|--------------------------------------------------------------------------
| Logout
|--------------------------------------------------------------------------
*/

export const logoutAdmin = async (
  rawRefreshToken
) => {
  if (!rawRefreshToken) {
    return null;
  }

  const revokedSession = await RefreshToken.findOneAndUpdate(
    {
      tokenHash: hashToken(rawRefreshToken),
      adminUser: {
        $ne: null,
      },
      revokedAt: null,
    },
    {
      $set: {
        revokedAt: new Date(),
      },
    },
    { returnDocument: "after" }
  )
    .select("adminUser")
    .lean();
  return revokedSession?.adminUser
    ? String(revokedSession.adminUser)
    : null;
};

/*
|--------------------------------------------------------------------------
| Get Current Admin
|--------------------------------------------------------------------------
*/

export const getCurrentAdmin = async (adminId) => {
  const admin = await AdminUser.findById(adminId).populate({
    path: "role",
    populate: {
      path: "permissions",
      select: "name resource action description",
    },
  });

  if (!admin || admin.status !== "active" || !hasActiveRole(admin)) {
    const error = new Error(
      "Admin account is not available"
    );
    error.statusCode = 401;
    throw error;
  }

  return publicAdmin(admin);
};