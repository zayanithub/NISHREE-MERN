import test from "node:test";
import assert from "node:assert/strict";
import bcrypt from "bcryptjs";
import { OAuth2Client } from "google-auth-library";
import OTPVerification from "../models/OTPVerification.js";
import RefreshToken from "../models/RefreshToken.js";
import User from "../models/User.js";
import {
  createGoogleLoginChallenge,
  getGoogleLoginChallenge,
  loginUser,
  resendGoogleLoginOtp,
  verifyGoogleLoginOtp,
} from "../service/authService.js";
import {
  completeGoogleAuthorization,
  createGoogleAuthorizationRequest,
} from "../service/googleAuthService.js";

const USER_ID = "507f1f77bcf86cd799439011";

const query = (value) => ({
  select() {
    return this;
  },
  then(resolve, reject) {
    return Promise.resolve(value).then(resolve, reject);
  },
});

test("Google identity starts a separate OTP challenge and cannot create a session before verification", async (t) => {
  const envKeys = [
    "JWT_ACCESS_SECRET",
    "GOOGLE_CLIENT_ID",
    "GOOGLE_CLIENT_SECRET",
    "GOOGLE_CALLBACK_URL",
    "RESEND_API_KEY",
    "EMAIL_FROM",
    "NODE_ENV",
  ];
  const previousEnv = Object.fromEntries(envKeys.map((key) => [key, process.env[key]]));
  Object.assign(process.env, {
    JWT_ACCESS_SECRET: "google-otp-test-secret-with-at-least-32-bytes",
    GOOGLE_CLIENT_ID: "google-client-id.apps.googleusercontent.com",
    GOOGLE_CLIENT_SECRET: "google-client-secret",
    GOOGLE_CALLBACK_URL: "http://localhost:5000/api/v1/auth/google/callback",
    RESEND_API_KEY: "re_google_otp_test",
    EMAIL_FROM: "onboarding@resend.dev",
    NODE_ENV: "test",
  });
  t.after(() => {
    for (const [key, value] of Object.entries(previousEnv)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  });

  let user = null;
  let challenge = null;
  let payload = null;
  let createCount = 0;
  const emailMessages = [];
  const refreshRecords = [];
  let authorizationOptions;

  t.mock.method(OAuth2Client.prototype, "generateAuthUrl", (options) => {
    authorizationOptions = options;
    return "https://accounts.google.com/o/oauth2/v2/auth";
  });
  t.mock.method(OAuth2Client.prototype, "getToken", async () => ({
    tokens: { id_token: "google-id-token" },
  }));
  t.mock.method(OAuth2Client.prototype, "verifyIdToken", async ({ audience }) => {
    assert.equal(audience, process.env.GOOGLE_CLIENT_ID);
    return { getPayload: () => payload };
  });
  t.mock.method(User, "findOne", () => query(user));
  t.mock.method(User, "create", async (record) => {
    createCount += 1;
    user = {
      ...record,
      _id: USER_ID,
      status: "active",
      isEmailVerified: false,
      async save() {},
    };
    return user;
  });
  t.mock.method(User, "findById", () => query(user));
  t.mock.method(bcrypt, "hash", async () => "hashed-provider-password");
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
  t.mock.method(OTPVerification, "findOne", (filter) => {
    const active =
      challenge &&
      String(challenge._id) === String(filter._id) &&
      challenge.purpose === filter.purpose &&
      !challenge.verifiedAt &&
      !challenge.consumedAt &&
      !challenge.revokedAt &&
      (!filter.expiresAt || challenge.expiresAt > filter.expiresAt.$gt) &&
      (!filter.attempts || challenge.attempts < filter.attempts.$lt);
    return query(active ? challenge : null);
  });
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
    emailMessages.push(JSON.parse(options.body));
    return new Response(JSON.stringify({ id: `google-email-${emailMessages.length}` }), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  });

  const request = createGoogleAuthorizationRequest({ returnTo: "https://example.com" });
  assert.equal(authorizationOptions.scope.includes("openid"), true);
  assert.equal(authorizationOptions.prompt, "select_account");
  assert.equal(request.authorizationUrl, "https://accounts.google.com/o/oauth2/v2/auth");

  payload = {
    iss: "https://accounts.google.com",
    aud: process.env.GOOGLE_CLIENT_ID,
    exp: Math.floor(Date.now() / 1000) + 300,
    nonce: authorizationOptions.nonce,
    email: "Customer@Example.Test",
    email_verified: true,
    sub: "google-subject-123",
    name: "Nishree Customer",
  };
  const verifiedPayload = payload;
  for (const invalidPayload of [
    { ...verifiedPayload, iss: "https://accounts.google.evil.test" },
    { ...verifiedPayload, aud: "another-client.apps.googleusercontent.com" },
    { ...verifiedPayload, exp: Math.floor(Date.now() / 1000) - 1 },
    { ...verifiedPayload, nonce: "incorrect-nonce" },
    { ...verifiedPayload, email_verified: false },
  ]) {
    payload = invalidPayload;
    await assert.rejects(
      completeGoogleAuthorization({
        code: "authorization-code",
        state: authorizationOptions.state,
        stateToken: request.stateToken,
      }),
      { statusCode: 401 },
    );
  }
  assert.equal(createCount, 0);
  assert.equal(emailMessages.length, 0);

  payload = verifiedPayload;
  const oauth = await completeGoogleAuthorization({
    code: "authorization-code",
    state: authorizationOptions.state,
    stateToken: request.stateToken,
  });

  assert.equal(oauth.returnTo, "/home");
  assert.equal(createCount, 1);
  assert.equal(user.email, "customer@example.test");
  assert.equal(user.isEmailVerified, false);
  assert.equal(challenge.purpose, "google_login");
  assert.equal(refreshRecords.length, 0);
  assert.equal(emailMessages.length, 1);
  assert.equal(emailMessages[0].to, "customer@example.test");
  assert.match(emailMessages[0].text, /sign-in code/);
  await assert.rejects(
    loginUser({ email: user.email, password: "provider-password" }),
    { statusCode: 403 },
  );
  assert.equal(refreshRecords.length, 0);

  await assert.rejects(
    completeGoogleAuthorization({
      code: "authorization-code",
      state: "attacker-controlled-state",
      stateToken: request.stateToken,
    }),
    { statusCode: 400 },
  );
  assert.equal(createCount, 1);

  const challengeInfo = await getGoogleLoginChallenge({ challengeId: oauth.challengeId });
  assert.equal(challengeInfo.maskedEmail, "cu******@example.test");
  await assert.rejects(
    verifyGoogleLoginOtp({ challengeId: oauth.challengeId, otp: "000000" }),
    { statusCode: 400 },
  );
  assert.equal(refreshRecords.length, 0);

  await assert.rejects(
    resendGoogleLoginOtp({ challengeId: oauth.challengeId }),
    { statusCode: 429 },
  );
  challenge.updatedAt = new Date(Date.now() - 61_000);
  const resent = await resendGoogleLoginOtp({ challengeId: oauth.challengeId });
  assert.equal(emailMessages.length, 2);
  assert.ok(Date.parse(resent.expiresAt) > Date.now());
  const code = emailMessages[1].text.match(/\b\d{6}\b/)[0];
  assert.notEqual(challenge.otpHash, code);

  const session = await verifyGoogleLoginOtp({
    challengeId: oauth.challengeId,
    otp: code,
  });
  assert.equal(session.user.id, USER_ID);
  assert.equal(typeof session.accessToken, "string");
  assert.equal(user.isEmailVerified, true);
  assert.equal(refreshRecords.length, 1);
  await assert.rejects(
    verifyGoogleLoginOtp({ challengeId: oauth.challengeId, otp: code }),
    { statusCode: 400 },
  );

  const expiredChallengeId = await createGoogleLoginChallenge(user);
  challenge.expiresAt = new Date(Date.now() - 1_000);
  await assert.rejects(
    getGoogleLoginChallenge({ challengeId: expiredChallengeId }),
    { statusCode: 400 },
  );
  await assert.rejects(
    verifyGoogleLoginOtp({ challengeId: expiredChallengeId, otp: code }),
    { statusCode: 400 },
  );
  assert.equal(refreshRecords.length, 1);
});
