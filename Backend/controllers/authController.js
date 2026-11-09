import User from "../models/User.js";

import {
  registerUser,
  loginUser,
  resendUserRegistrationOtp,
  verifyUserEmail,
  requestPasswordReset,
  verifyPasswordResetOtp,
  resetUserPassword,
  refreshUserSession,
  logoutUser,
  getGoogleLoginChallenge,
  resendGoogleLoginOtp,
  verifyGoogleLoginOtp,
} from "../service/authService.js";
import {
  completeGoogleAuthorization,
  createGoogleAuthorizationRequest,
  isGoogleOAuthConfigured,
} from "../service/googleAuthService.js";

const isProduction = process.env.NODE_ENV === "production";
const sameSite = (process.env.COOKIE_SAME_SITE || "lax").toLowerCase();
const refreshTokenDays =
  Number(process.env.JWT_REFRESH_EXPIRES_IN?.replace(/d$/i, "")) || 7;

const cookieOptions = {
  httpOnly: true,
  secure: isProduction || sameSite === "none",
  sameSite,
  path: "/api/v1/auth",
  maxAge: refreshTokenDays * 24 * 60 * 60 * 1000,
};

const setRefreshCookie = (res, token) => {
  res.cookie("nishree_refresh", token, cookieOptions);
};

const clearRefreshCookie = (res) => {
  res.clearCookie("nishree_refresh", {
    httpOnly: true,
    secure: isProduction || sameSite === "none",
    sameSite,
    path: "/api/v1/auth",
  });
};

const googleStateCookie = "nishree_google_oauth_state";
const googleStateCookieOptions = {
  httpOnly: true,
  secure: isProduction || sameSite === "none",
  sameSite: "lax",
  path: "/api/v1/auth/google",
  maxAge: 10 * 60 * 1000,
};

const clearGoogleStateCookie = (res) => {
  res.clearCookie(googleStateCookie, {
    httpOnly: true,
    secure: isProduction || sameSite === "none",
    sameSite: "lax",
    path: "/api/v1/auth/google",
  });
};

const authRedirect = (res, values) => {
  const frontendUrl = process.env.FRONTEND_URL || "http://localhost:5173";
  const target = new URL("/login", frontendUrl);
  res.set("Cache-Control", "no-store");
  for (const [key, value] of Object.entries(values)) {
    if (value) target.searchParams.set(key, value);
  }
  res.redirect(target.toString());
};

export const googleStatus = (_req, res) => {
  res.set("Cache-Control", "no-store");
  res.status(200).json({ success: true, enabled: isGoogleOAuthConfigured() });
};

export const startGoogleAuth = (req, res) => {
  const request = createGoogleAuthorizationRequest({
    returnTo: req.query.returnTo,
  });
  res.cookie(googleStateCookie, request.stateToken, googleStateCookieOptions);
  res.redirect(request.authorizationUrl);
};

export const googleCallback = async (req, res) => {
  const stateToken = req.cookies?.[googleStateCookie];
  clearGoogleStateCookie(res);

  if (req.query.error === "access_denied") {
    authRedirect(res, { googleError: "cancelled" });
    return;
  }
  if (typeof req.query.code !== "string" || typeof req.query.state !== "string") {
    authRedirect(res, { googleError: "failed" });
    return;
  }

  try {
    const result = await completeGoogleAuthorization({
      code: req.query.code,
      state: req.query.state,
      stateToken,
    });
    authRedirect(res, {
      googleChallenge: result.challengeId,
      returnTo: result.returnTo,
    });
  } catch (error) {
    console.error("Google OAuth callback failed:", {
      name: error instanceof Error ? error.name : typeof error,
      code: error?.code,
      statusCode: error?.statusCode,
    });
    authRedirect(res, {
      googleError:
        error?.code === "OTP_EMAIL_DELIVERY_FAILED"
          ? "delivery"
          : error?.statusCode === 403
            ? "unavailable"
            : "failed",
    });
  }
};

export const googleChallengeDetails = async (req, res) => {
  const result = await getGoogleLoginChallenge({
    challengeId: req.params.challengeId,
  });
  res.set("Cache-Control", "no-store");
  res.status(200).json({ success: true, ...result });
};

export const resendGoogleOtp = async (req, res) => {
  const result = await resendGoogleLoginOtp(req.validatedBody);
  res.status(200).json({
    success: true,
    message: "A new sign-in code has been sent to your email address.",
    ...result,
  });
};

export const verifyGoogleOtp = async (req, res) => {
  const result = await verifyGoogleLoginOtp(req.validatedBody);
  setRefreshCookie(res, result.refreshToken);
  res.status(200).json({
    success: true,
    message: "Signed in successfully.",
    user: result.user,
    accessToken: result.accessToken,
  });
};

export const register = async (req, res) => {
  const result = await registerUser(req.validatedBody);

  res.status(202).json({
    success: true,
    message: "Enter the verification code sent to your email address.",
    user: result.user,
    challengeId: result.challengeId,
    otpRequired: true,
  });
};

export const login = async (req, res) => {
  const result = await loginUser(req.validatedBody);
  setRefreshCookie(res, result.refreshToken);
  res.status(200).json({
    success: true,
    message: "Signed in successfully.",
    user: result.user,
    accessToken: result.accessToken,
  });
};

export const resendRegistrationOtp = async (req, res) => {
  const result = await resendUserRegistrationOtp(req.validatedBody);
  res.status(200).json({
    success: true,
    message: "A new verification code has been sent to your email address.",
    challengeId: result.challengeId,
    otpRequired: true,
  });
};

export const verifyRegistrationEmail = async (req, res) => {
  const result = await verifyUserEmail(req.validatedBody);
  setRefreshCookie(res, result.refreshToken);
  res.status(200).json({
    success: true,
    message: "Email verified. Your account is ready.",
    user: result.user,
    accessToken: result.accessToken,
  });
};

export const forgotPassword = async (req, res) => {
  const { challengeId } = await requestPasswordReset(req.validatedBody.email);
  res.status(202).json({
    success: true,
    message: "If an account exists for that email, a verification code has been sent.",
    challengeId,
  });
};

export const verifyForgotPasswordOtp = async (req, res) => {
  const result = await verifyPasswordResetOtp(req.validatedBody);
  res.status(200).json({
    success: true,
    message: "Code verified. Choose a new password.",
    resetToken: result.resetToken,
  });
};

export const resetPassword = async (req, res) => {
  const result = await resetUserPassword(req.validatedBody);
  res.status(200).json({
    success: true,
    message: "Your password has been reset. Please sign in.",
    emailSent: result.emailSent,
  });
};

export const refresh = async (req, res) => {
  const oldToken = req.cookies?.nishree_refresh;

  if (!oldToken) {
    return res.status(204).end();
  }

  try {
    const result = await refreshUserSession(oldToken);

    setRefreshCookie(res, result.refreshToken);

    res.status(200).json({
      success: true,
      accessToken: result.accessToken,
      user: result.user,
    });
  } catch (error) {
    clearRefreshCookie(res);
    if ([401, 403].includes(error.statusCode)) {
      return res.status(204).end();
    }
    throw error;
  }
};

export const logout = async (req, res) => {
  await logoutUser(req.cookies?.nishree_refresh);

  clearRefreshCookie(res);

  res.status(200).json({
    success: true,
    message: "Logged out successfully",
  });
};

export const getMe = async (req, res) => {
  const user = await User.findById(req.auth.userId).select(
    "name email phone status isEmailVerified isPhoneVerified profileImage"
  );

  if (!user || (user.status && user.status !== "active")) {
    return res.status(401).json({
      success: false,
      message: "Account is not available",
    });
  }

  res.status(200).json({
    success: true,
    user,
  });
};
