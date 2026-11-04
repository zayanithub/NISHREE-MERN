import test from "node:test";
import assert from "node:assert/strict";
import bcrypt from "bcryptjs";
import nodemailer from "nodemailer";

import OTPVerification from "../models/OTPVerification.js";
import PasswordResetToken from "../models/PasswordResetToken.js";
import RefreshToken from "../models/RefreshToken.js";
import User from "../models/User.js";
import { verifyEmailTransport } from "../service/emailService.js";
import {
  loginUser,
  requestPasswordReset,
  resetUserPassword,
  verifyPasswordResetOtp,
  verifyUserLogin,
} from "../service/authService.js";
import {
  forgotPasswordSchema,
  otpChallengeSchema,
  resetPasswordSchema,
} from "../validations/authValidation.js";

const USER_ID = "507f1f77bcf86cd799439011";

const query = (value) => ({
  select: async () => value,
  then: (resolve, reject) => Promise.resolve(value).then(resolve, reject),
});

test("customer login requires email OTP before issuing a session and supports password recovery", async (t) => {
  const envKeys = [
    "JWT_ACCESS_SECRET",
    "SMTP_HOST",
    "SMTP_PORT",
    "SMTP_SECURE",
    "SMTP_USER",
    "SMTP_PASS",
  ];
  const previousEnv = Object.fromEntries(
    envKeys.map((key) => [key, process.env[key]])
  );
  Object.assign(process.env, {
    JWT_ACCESS_SECRET: "auth-test-secret-with-more-than-32-bytes",
    SMTP_HOST: "smtp.example.test",
    SMTP_PORT: "465",
    SMTP_SECURE: "true",
    SMTP_USER: "sender@example.test",
    SMTP_PASS: "smtp-test-password",
  });
  t.after(() => {
    for (const [key, value] of Object.entries(previousEnv)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  });

  const user = {
    _id: USER_ID,
    name: "Nishree Customer",
    email: "customer@example.test",
    phone: null,
    status: "active",
    isEmailVerified: false,
    async save() {},
  };
  let storedOtp;
  let resetRecord;
  let sentMessage;
  let smtpUnavailable = false;
  let transportOptions;
  const refreshRecords = [];

  t.mock.method(User, "findOne", () => query(user));
  t.mock.method(User, "findById", () => query(user));
  t.mock.method(User, "findOneAndUpdate", async (_filter, update) => {
    Object.assign(user, update.$set);
    return user;
  });
  t.mock.method(bcrypt, "compare", async () => true);
  t.mock.method(bcrypt, "hash", async (password) => `hashed:${password}`);
  t.mock.method(OTPVerification, "updateMany", async () => ({ modifiedCount: 1 }));
  t.mock.method(OTPVerification, "create", async (record) => {
    storedOtp = { ...record, attempts: 0 };
    return storedOtp;
  });
  t.mock.method(OTPVerification, "updateOne", async (_filter, update) => {
    Object.assign(storedOtp, update.$set);
    return { modifiedCount: 1 };
  });
  t.mock.method(OTPVerification, "findOne", () => query(storedOtp));
  t.mock.method(OTPVerification, "findOneAndUpdate", async (_filter, update) => {
    if (update.$inc?.attempts) storedOtp.attempts += update.$inc.attempts;
    Object.assign(storedOtp, update.$set);
    return storedOtp;
  });
  t.mock.method(PasswordResetToken, "create", async (record) => {
    resetRecord = record;
    return record;
  });
  t.mock.method(PasswordResetToken, "findOneAndUpdate", async (_filter, update) => {
    Object.assign(resetRecord, update.$set);
    return resetRecord;
  });
  t.mock.method(PasswordResetToken, "updateMany", async () => ({ modifiedCount: 1 }));
  t.mock.method(RefreshToken, "create", async (record) => {
    refreshRecords.push(record);
    return { _id: "refresh-session" };
  });
  t.mock.method(RefreshToken, "updateMany", async () => ({ modifiedCount: 1 }));
  t.mock.method(nodemailer, "createTransport", (options) => {
    transportOptions = options;
    return {
      verify: async () => true,
      sendMail: async (message) => {
        if (smtpUnavailable) {
          throw Object.assign(new Error("SMTP authentication failed"), {
            code: "EAUTH",
            responseCode: 535,
          });
        }
        sentMessage = message;
        return { messageId: "auth-email-1" };
      },
    };
  });

  await verifyEmailTransport();
  assert.equal(transportOptions.secure, true);
  assert.equal(transportOptions.auth.user, "sender@example.test");
  const loginChallenge = await loginUser({
    email: user.email,
    password: "correct-password",
  });
  assert.equal(loginChallenge.otpRequired, true);
  assert.equal(loginChallenge.accessToken, undefined);
  assert.equal(sentMessage.to, user.email);
  assert.match(sentMessage.text, /\b\d{6}\b/);
  assert.notEqual(storedOtp.otpHash, sentMessage.text.match(/\b\d{6}\b/)[0]);

  const loginCode = sentMessage.text.match(/\b\d{6}\b/)[0];
  const session = await verifyUserLogin({
    challengeId: loginChallenge.challengeId,
    otp: loginCode,
  });
  assert.equal(session.user.id, USER_ID);
  assert.equal(typeof session.accessToken, "string");
  assert.equal(user.isEmailVerified, true);
  assert.ok(refreshRecords[0].otpVerifiedAt instanceof Date);

  const resetChallenge = await requestPasswordReset(user.email);
  const resetCode = sentMessage.text.match(/\b\d{6}\b/)[0];
  const verifiedReset = await verifyPasswordResetOtp({
    challengeId: resetChallenge.challengeId,
    otp: resetCode,
  });
  assert.match(verifiedReset.resetToken, /^[a-f\d]{64}$/i);
  assert.notEqual(resetRecord.tokenHash, verifiedReset.resetToken);

  assert.deepEqual(
    await resetUserPassword({
      resetToken: verifiedReset.resetToken,
      password: "new-password-123",
    }),
    { success: true, emailSent: true }
  );
  assert.equal(user.passwordHash, "hashed:new-password-123");
  assert.ok(resetRecord.usedAt instanceof Date);

  smtpUnavailable = true;
  await assert.rejects(
    loginUser({ email: user.email, password: "correct-password" }),
    {
      statusCode: 503,
      code: "OTP_EMAIL_DELIVERY_FAILED",
      message: "Verification code email could not be sent. Please try again later.",
    }
  );
  assert.ok(storedOtp.revokedAt instanceof Date);
});

test("rejects malformed, expired, and incorrect OTP challenges", async (t) => {
  const previousSecret = process.env.JWT_ACCESS_SECRET;
  process.env.JWT_ACCESS_SECRET = "auth-test-secret-with-more-than-32-bytes";
  t.after(() => {
    if (previousSecret === undefined) delete process.env.JWT_ACCESS_SECRET;
    else process.env.JWT_ACCESS_SECRET = previousSecret;
  });

  assert.equal(
    otpChallengeSchema.safeParse({
      challengeId: "507f1f77bcf86cd799439011",
      otp: "12345",
    }).success,
    false
  );
  assert.equal(
    forgotPasswordSchema.safeParse({ email: "not-an-email" }).success,
    false
  );
  assert.equal(
    resetPasswordSchema.safeParse({
      resetToken: "short",
      password: "short",
    }).success,
    false
  );

  const challenge = {
    _id: "507f1f77bcf86cd799439011",
    otpHash: "0".repeat(64),
    attempts: 0,
  };
  let active = true;
  t.mock.method(OTPVerification, "findOne", () => query(active ? challenge : null));
  t.mock.method(OTPVerification, "findOneAndUpdate", async (filter, update) => {
    assert.equal(filter.attempts, challenge.attempts);
    challenge.attempts += update.$inc.attempts;
    if (challenge.attempts >= 5) active = false;
    return challenge;
  });
  await assert.rejects(
    verifyUserLogin({
      challengeId: challenge._id,
      otp: "123456",
    }),
    { statusCode: 400 }
  );
  assert.equal(challenge.attempts, 1);

  active = false;
  await assert.rejects(
    verifyUserLogin({ challengeId: challenge._id, otp: "123456" }),
    { statusCode: 400 }
  );
});
