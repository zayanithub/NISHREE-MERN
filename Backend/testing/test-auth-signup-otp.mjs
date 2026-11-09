import test from "node:test";
import assert from "node:assert/strict";
import bcrypt from "bcryptjs";

import OTPVerification from "../models/OTPVerification.js";
import RefreshToken from "../models/RefreshToken.js";
import User from "../models/User.js";
import {
  loginUser,
  registerUser,
  resendUserRegistrationOtp,
  verifyUserEmail,
} from "../service/authService.js";

const USER_ID = "507f1f77bcf86cd799439011";

const query = (value) => ({
  select() {
    return this;
  },
  then(resolve, reject) {
    return Promise.resolve(value).then(resolve, reject);
  },
});

test("signup OTP is hashed, resend is throttled, verification is single-use, and login sends no OTP", async (t) => {
  const envKeys = ["JWT_ACCESS_SECRET", "RESEND_API_KEY", "EMAIL_FROM"];
  const previousEnv = Object.fromEntries(envKeys.map((key) => [key, process.env[key]]));
  Object.assign(process.env, {
    JWT_ACCESS_SECRET: "signup-otp-test-secret-with-at-least-32-bytes",
    RESEND_API_KEY: "re_signup_test",
    EMAIL_FROM: "onboarding@resend.dev",
  });
  t.after(() => {
    for (const [key, value] of Object.entries(previousEnv)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  });

  let user = null;
  let challenge = null;
  const messages = [];
  const idempotencyKeys = [];
  const refreshRecords = [];
  t.mock.method(User, "findOne", () => query(user));
  t.mock.method(User, "findById", () => query(user));
  t.mock.method(User, "create", async (record) => {
    user = {
      ...record,
      _id: USER_ID,
      status: "active",
      isEmailVerified: false,
      async save() {},
    };
    return user;
  });
  t.mock.method(bcrypt, "hash", async () => "hashed-password");
  t.mock.method(bcrypt, "compare", async () => true);
  t.mock.method(OTPVerification, "updateMany", async () => ({ modifiedCount: 0 }));
  t.mock.method(OTPVerification, "create", async (record) => {
    challenge = {
      ...record,
      attempts: 0,
      updatedAt: new Date(),
      verifiedAt: null,
      consumedAt: null,
      revokedAt: null,
    };
    return challenge;
  });
  t.mock.method(OTPVerification, "findOne", (filter) =>
    query(
      challenge &&
        String(challenge._id) === String(filter._id) &&
        challenge.purpose === filter.purpose &&
        !challenge.verifiedAt &&
        !challenge.consumedAt &&
        !challenge.revokedAt
        ? challenge
        : null
    )
  );
  t.mock.method(OTPVerification, "findOneAndUpdate", async (filter, update) => {
    if (
      !challenge ||
      String(challenge._id) !== String(filter._id) ||
      challenge.attempts !== filter.attempts ||
      (filter.updatedAt &&
        challenge.updatedAt.getTime() !== filter.updatedAt.getTime())
    ) {
      return null;
    }
    if (update.$inc?.attempts) challenge.attempts += update.$inc.attempts;
    Object.assign(challenge, update.$set);
    return challenge;
  });
  t.mock.method(OTPVerification, "updateOne", async (_filter, update) => {
    Object.assign(challenge, update.$set);
    return { modifiedCount: 1 };
  });
  t.mock.method(RefreshToken, "create", async (record) => {
    refreshRecords.push(record);
    return { _id: `refresh-${refreshRecords.length}` };
  });
  t.mock.method(globalThis, "fetch", async (_url, options) => {
    messages.push(JSON.parse(options.body));
    idempotencyKeys.push(options.headers.get("idempotency-key"));
    return new Response(JSON.stringify({ id: `signup-email-${messages.length}` }), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  });
  t.mock.method(console, "error", () => {});

  const signup = await registerUser({
    name: "Nishree Customer",
    email: "customer@example.test",
    password: "correct-password",
  });
  assert.equal(signup.otpRequired, true);
  assert.equal(user.isEmailVerified, false);
  assert.equal(challenge.purpose, "email_verification");
  const firstCode = messages[0].text.match(/\b\d{6}\b/)[0];
  assert.notEqual(challenge.otpHash, firstCode);
  assert.ok(idempotencyKeys[0]);

  await assert.rejects(
    resendUserRegistrationOtp({ challengeId: signup.challengeId }),
    { statusCode: 429 }
  );
  challenge.updatedAt = new Date(Date.now() - 61_000);
  await resendUserRegistrationOtp({ challengeId: signup.challengeId });
  assert.equal(messages.length, 2);
  assert.notEqual(idempotencyKeys[1], idempotencyKeys[0]);
  const resentCode = messages[1].text.match(/\b\d{6}\b/)[0];
  assert.notEqual(challenge.otpHash, resentCode);

  const session = await verifyUserEmail({
    challengeId: signup.challengeId,
    otp: resentCode,
  });
  assert.equal(user.isEmailVerified, true);
  assert.equal(session.user.id, USER_ID);
  assert.equal(typeof session.accessToken, "string");
  assert.equal(refreshRecords.length, 1);
  await assert.rejects(
    verifyUserEmail({ challengeId: signup.challengeId, otp: resentCode }),
    { statusCode: 400 }
  );

  const userLogin = await loginUser({
    email: user.email,
    password: "correct-password",
  });
  assert.equal(typeof userLogin.accessToken, "string");
  assert.equal(userLogin.otpRequired, undefined);
  assert.equal(messages.length, 2);
  assert.equal(refreshRecords.length, 2);
});
