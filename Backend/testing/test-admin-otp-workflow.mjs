import test from "node:test";
import assert from "node:assert/strict";
import bcrypt from "bcryptjs";
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
  const envKeys = ["JWT_ACCESS_SECRET", "RESEND_API_KEY", "EMAIL_FROM"];
  const previousEnv = Object.fromEntries(envKeys.map((key) => [key, process.env[key]]));
  Object.assign(process.env, {
    JWT_ACCESS_SECRET: "admin-otp-test-secret-with-more-than-32-bytes",
    RESEND_API_KEY: "re_admin_test",
    EMAIL_FROM: "onboarding@resend.dev",
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
    role: {
      _id: "507f1f77bcf86cd799439012",
      name: "super_admin",
      isActive: true,
      permissions: [],
    },
    async save() {},
  };
  let challenge = null;
  let sentMessage = null;
  const sentMessages = [];
  const idempotencyKeys = [];
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
  t.mock.method(globalThis, "fetch", async (_url, options) => {
    sentMessage = JSON.parse(options.body);
    sentMessages.push(sentMessage);
    idempotencyKeys.push(options.headers.get("idempotency-key"));
    return new Response(JSON.stringify({ id: "admin-otp-1" }), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  });

  const pending = await loginAdmin({ email: admin.email, password: "correct-password" });
  assert.equal(pending.otpRequired, true);
  assert.equal(pending.email, admin.email);
  assert.equal(pending.accessToken, undefined);
  assert.equal(refreshRecords.length, 0);
  assert.equal(sentMessages[0].to, admin.email);
  assert.equal(sentMessages[0].subject, "Your Nishree Attire admin sign-in code");
  assert.match(sentMessages[0].html, /Verify your admin sign-in/);
  assert.match(sentMessages[0].html, new RegExp(sentMessages[0].text.match(/\b\d{6}\b/)[0]));
  assert.match(idempotencyKeys[0], /^otp-admin_login-[^-]+-[a-f0-9]{64}$/);

  await assert.rejects(resendAdminLoginOtp({ challengeId: pending.challengeId }), { statusCode: 429 });
  challenge.updatedAt = new Date(Date.now() - 61_000);
  const resent = await resendAdminLoginOtp({ challengeId: pending.challengeId });
  assert.equal(resent.challengeId, pending.challengeId);
  assert.equal(idempotencyKeys.length, 2);
  assert.notEqual(idempotencyKeys[1], idempotencyKeys[0]);
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

  const expiring = await loginAdmin({
    email: admin.email,
    password: "correct-password",
  });
  challenge.expiresAt = new Date(Date.now() - 1_000);
  await assert.rejects(
    verifyAdminLoginOtp({ challengeId: expiring.challengeId, otp: "123456" }),
    { statusCode: 400 }
  );
  assert.equal(refreshRecords.length, 2);
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

test("admin login rejects accounts without an active database role", async (t) => {
  const admin = {
    _id: ADMIN_ID,
    email: "admin@example.test",
    passwordHash: "hashed-password",
    status: "active",
    role: null,
  };
  t.mock.method(AdminUser, "findOne", () => query(admin));
  t.mock.method(bcrypt, "compare", async () => true);

  await assert.rejects(
    loginAdmin({ email: admin.email, password: "correct-password" }),
    { statusCode: 403 }
  );
});
