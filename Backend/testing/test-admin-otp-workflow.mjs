import test from "node:test";
import assert from "node:assert/strict";
import bcrypt from "bcryptjs";
import nodemailer from "nodemailer";
import AdminUser from "../models/AdminUser.js";
import OTPVerification from "../models/OTPVerification.js";
import RefreshToken from "../models/RefreshToken.js";
import {
  loginAdmin,
  refreshAdminSession,
  resendAdminLoginOtp,
  verifyAdminLoginOtp,
} from "../service/adminAuthService.js";

const ADMIN_ID = "507f1f77bcf86cd799439011";

const query = (value) => ({
  select() { return this; },
  populate() { return this; },
  then(resolve, reject) { return Promise.resolve(value).then(resolve, reject); },
});

test("admin credentials issue only an OTP challenge; verified OTP creates a single-use session", async (t) => {
  const envKeys = ["JWT_ACCESS_SECRET", "SMTP_HOST", "SMTP_PORT", "SMTP_SECURE", "SMTP_USER", "SMTP_PASS"];
  const previousEnv = Object.fromEntries(envKeys.map((key) => [key, process.env[key]]));
  Object.assign(process.env, {
    JWT_ACCESS_SECRET: "admin-otp-test-secret-with-more-than-32-bytes",
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

  const admin = {
    _id: ADMIN_ID,
    name: "Store Administrator",
    email: "admin@example.test",
    passwordHash: "hashed-password",
    status: "active",
    role: null,
    async save() {},
  };
  let challenge = null;
  let sentMessage = null;
  const refreshRecords = [];

  t.mock.method(AdminUser, "findOne", () => query(admin));
  t.mock.method(AdminUser, "findById", () => query(admin));
  t.mock.method(bcrypt, "compare", async () => true);
  t.mock.method(OTPVerification, "updateMany", async () => ({ modifiedCount: 0 }));
  t.mock.method(OTPVerification, "create", async (record) => {
    challenge = {
      ...record,
      attempts: 0,
      createdAt: new Date(),
      updatedAt: new Date(),
      verifiedAt: null,
      consumedAt: null,
      revokedAt: null,
    };
    return challenge;
  });
  t.mock.method(OTPVerification, "updateOne", async (_filter, update) => {
    Object.assign(challenge, update.$set);
    return { modifiedCount: 1 };
  });
  t.mock.method(OTPVerification, "findOne", (filter) => {
    const active = challenge
      && String(challenge._id) === String(filter._id)
      && challenge.purpose === filter.purpose
      && challenge.expiresAt > filter.expiresAt.$gt
      && !challenge.verifiedAt
      && !challenge.consumedAt
      && !challenge.revokedAt
      && challenge.attempts < filter.attempts.$lt;
    return query(active ? challenge : null);
  });
  t.mock.method(OTPVerification, "findOneAndUpdate", async (filter, update) => {
    if (!challenge
      || String(challenge._id) !== String(filter._id)
      || challenge.consumedAt
      || challenge.revokedAt
      || challenge.attempts !== filter.attempts
      || (filter.updatedAt && challenge.updatedAt.getTime() !== filter.updatedAt.getTime())) {
      return null;
    }
    if (update.$inc?.attempts) challenge.attempts += update.$inc.attempts;
    Object.assign(challenge, update.$set);
    return challenge;
  });
  t.mock.method(RefreshToken, "create", async (record) => {
    refreshRecords.push({ ...record, _id: `refresh-${refreshRecords.length + 1}`, revokedAt: null });
    return { _id: "refresh-session" };
  });
  t.mock.method(nodemailer, "createTransport", () => ({
    sendMail: async (message) => {
      sentMessage = message;
      return { messageId: "admin-otp-1" };
    },
  }));

  const pending = await loginAdmin({ email: admin.email, password: "correct-password" });
  assert.equal(pending.otpRequired, true);
  assert.equal(pending.email, admin.email);
  assert.equal(pending.accessToken, undefined);
  assert.equal(refreshRecords.length, 0);

  await assert.rejects(resendAdminLoginOtp({ challengeId: pending.challengeId }), { statusCode: 429 });
  challenge.updatedAt = new Date(Date.now() - 61_000);
  const resent = await resendAdminLoginOtp({ challengeId: pending.challengeId });
  assert.equal(resent.challengeId, pending.challengeId);
  const code = sentMessage.text.match(/\b\d{6}\b/)[0];
  assert.notEqual(challenge.otpHash, code);

  await assert.rejects(
    verifyAdminLoginOtp({ challengeId: pending.challengeId, otp: "000000" === code ? "000001" : "000000" }),
    { statusCode: 400 },
  );
  assert.equal(challenge.attempts, 1);

  const session = await verifyAdminLoginOtp({ challengeId: pending.challengeId, otp: code });
  assert.equal(session.admin.id, ADMIN_ID);
  assert.equal(typeof session.accessToken, "string");
  assert.equal(refreshRecords.length, 1);
  assert.ok(refreshRecords[0].otpVerifiedAt instanceof Date);
  assert.ok(challenge.consumedAt instanceof Date);
  await assert.rejects(
    verifyAdminLoginOtp({ challengeId: pending.challengeId, otp: code }),
    { statusCode: 400 },
  );

  t.mock.method(RefreshToken, "findOne", (filter) => {
    assert.deepEqual(filter.otpVerifiedAt, { $type: "date" });
    return query(refreshRecords.at(-1));
  });
  t.mock.method(RefreshToken, "findOneAndUpdate", async (_filter, update) => {
    Object.assign(refreshRecords.at(-1), update.$set);
    return refreshRecords.at(-1);
  });
  await refreshAdminSession(session.refreshToken);
  assert.equal(refreshRecords.length, 2);
  assert.ok(refreshRecords[1].otpVerifiedAt instanceof Date);
});

test("legacy admin refresh tokens without OTP proof cannot refresh", async (t) => {
  let lookupFilter;
  t.mock.method(RefreshToken, "findOne", (filter) => {
    lookupFilter = filter;
    return query(null);
  });
  await assert.rejects(refreshAdminSession("legacy-refresh-token"), { statusCode: 401 });
  assert.deepEqual(lookupFilter.otpVerifiedAt, { $type: "date" });
});
