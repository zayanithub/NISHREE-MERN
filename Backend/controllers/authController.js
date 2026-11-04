import User from "../models/User.js";

import {
  registerUser,
  loginUser,
  verifyUserLogin,
  verifyUserEmail,
  requestPasswordReset,
  verifyPasswordResetOtp,
  resetUserPassword,
  refreshUserSession,
  logoutUser,
} from "../service/authService.js";

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

  res.status(202).json({
    success: true,
    message: "Enter the verification code sent to your email address.",
    challengeId: result.challengeId,
    otpRequired: true,
  });
};

export const verifyLoginOtp = async (req, res) => {
  const result = await verifyUserLogin(req.validatedBody);
  setRefreshCookie(res, result.refreshToken);
  res.status(200).json({
    success: true,
    message: "Email verified. You are now signed in.",
    user: result.user,
    accessToken: result.accessToken,
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
