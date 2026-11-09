import bcrypt from "bcryptjs";
import crypto from "node:crypto";
import jwt from "jsonwebtoken";
import { OAuth2Client } from "google-auth-library";
import User from "../models/User.js";
import { createGoogleLoginChallenge } from "./authService.js";
import { isTransactionalEmailConfigured } from "./emailService.js";

const STATE_TTL_SECONDS = 10 * 60;
const STATE_ISSUER = "nishree-attire-google-oauth";
const STATE_AUDIENCE = "nishree-attire-google-oauth";
const GOOGLE_ISSUERS = new Set([
  "https://accounts.google.com",
  "accounts.google.com",
]);

const createError = (message, statusCode) => {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
};

const googleConfig = () => {
  const { GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_CALLBACK_URL } =
    process.env;
  if (
    !GOOGLE_CLIENT_ID?.trim() ||
    !GOOGLE_CLIENT_SECRET?.trim() ||
    !GOOGLE_CALLBACK_URL?.trim()
  ) {
    throw createError("Google sign-in is not configured.", 503);
  }

  let callbackUrl;
  try {
    callbackUrl = new URL(GOOGLE_CALLBACK_URL);
  } catch {
    throw createError("Google sign-in is not configured.", 503);
  }
  const isLocalHttp =
    process.env.NODE_ENV !== "production" &&
    callbackUrl.protocol === "http:" &&
    ["localhost", "127.0.0.1", "[::1]"].includes(callbackUrl.hostname);
  if (
    (callbackUrl.protocol !== "https:" && !isLocalHttp) ||
    callbackUrl.username ||
    callbackUrl.password ||
    callbackUrl.hash
  ) {
    throw createError("Google sign-in is not configured.", 503);
  }

  return {
    clientId: GOOGLE_CLIENT_ID.trim(),
    clientSecret: GOOGLE_CLIENT_SECRET.trim(),
    callbackUrl: callbackUrl.toString(),
  };
};

const createClient = (config) =>
  new OAuth2Client(
    config.clientId,
    config.clientSecret,
    config.callbackUrl
  );

const safeReturnTo = (value) => {
  if (typeof value !== "string" || !value.startsWith("/") || value.startsWith("//")) {
    return "/home";
  }
  try {
    const target = new URL(value, "https://nishree.invalid");
    if (target.origin !== "https://nishree.invalid") return "/home";
    return `${target.pathname}${target.search}${target.hash}`.slice(0, 2048);
  } catch {
    return "/home";
  }
};

const safeEqual = (left, right) => {
  const leftBuffer = Buffer.from(String(left || ""));
  const rightBuffer = Buffer.from(String(right || ""));
  return leftBuffer.length === rightBuffer.length &&
    crypto.timingSafeEqual(leftBuffer, rightBuffer);
};

export const isGoogleOAuthConfigured = () => {
  if (!process.env.JWT_ACCESS_SECRET || !isTransactionalEmailConfigured()) {
    return false;
  }
  try {
    googleConfig();
    return true;
  } catch (error) {
    if (error?.statusCode === 503) return false;
    throw error;
  }
};

export const createGoogleAuthorizationRequest = ({ returnTo }) => {
  const config = googleConfig();
  if (!process.env.JWT_ACCESS_SECRET) {
    throw new Error("JWT_ACCESS_SECRET is missing");
  }

  const state = crypto.randomBytes(32).toString("base64url");
  const nonce = crypto.randomBytes(32).toString("base64url");
  const stateToken = jwt.sign(
    { state, nonce, returnTo: safeReturnTo(returnTo) },
    process.env.JWT_ACCESS_SECRET,
    {
      expiresIn: STATE_TTL_SECONDS,
      issuer: STATE_ISSUER,
      audience: STATE_AUDIENCE,
    }
  );
  const authorizationUrl = createClient(config).generateAuthUrl({
    access_type: "online",
    prompt: "select_account",
    response_type: "code",
    scope: ["openid", "email", "profile"],
    state,
    nonce,
  });

  return { authorizationUrl, stateToken };
};

const findOrCreateGoogleUser = async ({ email, name }) => {
  let user = await User.findOne({ email }).select("+passwordHash");

  if (!user) {
    const randomPassword = crypto.randomBytes(32).toString("hex");
    const passwordHash = await bcrypt.hash(randomPassword, 12);
    try {
      user = await User.create({
        name: name.trim().slice(0, 100) || email.split("@")[0],
        email,
        passwordHash,
        isEmailVerified: false,
      });
    } catch (error) {
      if (error?.code !== 11000) throw error;
      user = await User.findOne({ email }).select("+passwordHash");
      if (!user) throw error;
    }
  }

  if (!user || (user.status && user.status !== "active")) {
    throw createError("This account is not available.", 403);
  }

  return user;
};

export const completeGoogleAuthorization = async ({
  code,
  state,
  stateToken,
}) => {
  const config = googleConfig();
  if (!process.env.JWT_ACCESS_SECRET) {
    throw new Error("JWT_ACCESS_SECRET is missing");
  }

  let savedState;
  try {
    savedState = jwt.verify(stateToken || "", process.env.JWT_ACCESS_SECRET, {
      issuer: STATE_ISSUER,
      audience: STATE_AUDIENCE,
    });
  } catch {
    throw createError("Google sign-in could not be verified. Please try again.", 400);
  }

  if (
    typeof savedState !== "object" ||
    !safeEqual(savedState.state, state) ||
    typeof savedState.nonce !== "string"
  ) {
    throw createError("Google sign-in could not be verified. Please try again.", 400);
  }

  let payload;
  try {
    const client = createClient(config);
    const { tokens } = await client.getToken(code);
    if (!tokens.id_token) throw new Error("Google did not return an ID token.");
    const ticket = await client.verifyIdToken({
      idToken: tokens.id_token,
      audience: config.clientId,
    });
    payload = ticket.getPayload();
  } catch {
    throw createError("Google sign-in could not be completed. Please try again.", 401);
  }

  const expectedAudience = config.clientId;
  const validAudience = Array.isArray(payload?.aud)
    ? payload.aud.includes(expectedAudience)
    : payload?.aud === expectedAudience;
  const validExpiry =
    Number.isFinite(payload?.exp) && payload.exp > Math.floor(Date.now() / 1000);
  if (
    !payload ||
    !GOOGLE_ISSUERS.has(payload.iss) ||
    !validAudience ||
    !validExpiry ||
    !safeEqual(payload.nonce, savedState.nonce) ||
    payload.email_verified !== true ||
    typeof payload.email !== "string" ||
    typeof payload.sub !== "string" ||
    !payload.sub
  ) {
    throw createError("Google sign-in could not be verified. Please try again.", 401);
  }

  const email = payload.email.trim().toLowerCase();
  const user = await findOrCreateGoogleUser({
    email,
    name: typeof payload.name === "string" ? payload.name : "",
  });
  const challengeId = await createGoogleLoginChallenge(user);

  return {
    challengeId,
    returnTo: safeReturnTo(savedState.returnTo),
  };
};
