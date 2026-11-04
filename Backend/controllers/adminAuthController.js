import {
  loginAdmin,
  resendAdminLoginOtp,
  verifyAdminLoginOtp,
  refreshAdminSession,
  logoutAdmin,
  getCurrentAdmin,
} from "../service/adminAuthService.js";
import { recordAuditEvent } from "../service/auditLogService.js";

const REFRESH_TOKEN_COOKIE = "adminRefreshToken";

const REFRESH_TOKEN_DAYS =
  Number(
    process.env.JWT_REFRESH_EXPIRES_IN?.replace(/d$/i, "")
  ) || 7;

const REFRESH_TOKEN_MAX_AGE =
  REFRESH_TOKEN_DAYS * 24 * 60 * 60 * 1000;

const cookieOptions = {
  httpOnly: true,
  secure:
    process.env.NODE_ENV === "production" ||
    process.env.COOKIE_SAME_SITE === "none",
  sameSite: (process.env.COOKIE_SAME_SITE || "lax").toLowerCase(),
  path: "/api/v1/admin/auth",
};

const setRefreshTokenCookie = (res, refreshToken) => {
  res.cookie(REFRESH_TOKEN_COOKIE, refreshToken, {
    ...cookieOptions,
    maxAge: REFRESH_TOKEN_MAX_AGE,
  });
};

const clearRefreshTokenCookie = (res) => {
  res.clearCookie(REFRESH_TOKEN_COOKIE, cookieOptions);
};

/*
|--------------------------------------------------------------------------
| Admin Login
|--------------------------------------------------------------------------
| POST /api/v1/admin/auth/login
*/

export const adminLogin = async (req, res, next) => {
  try {
    const credentials = req.validatedBody ?? req.body;

    const result = await loginAdmin(credentials);

    await recordAuditEvent({
      actorType: "system",
      action: "admin.login.otp_requested",
      resource: "admin_auth",
      description: "Administrator credentials validated and an OTP was sent",
      ipAddress: req.ip,
      requestId: req.get("x-request-id"),
      status: "success",
    });

    return res.status(200).json({
      success: true,
      message: "A verification code has been sent to the administrator email.",
      otpRequired: true,
      challengeId: result.challengeId,
      email: result.email,
    });
  } catch (error) {
    if ([401, 403].includes(error.statusCode)) {
      await recordAuditEvent({
        actorType: "system",
        action: "admin.login",
        resource: "admin_auth",
        description: "Administrator login failed",
        ipAddress: req.ip,
        requestId: req.get("x-request-id"),
        status: "failure",
      });
    }
    return next(error);
  }
};

export const adminLoginVerifyOtp = async (req, res, next) => {
  try {
    const result = await verifyAdminLoginOtp(req.validatedBody ?? req.body);
    await recordAuditEvent({
      actorType: "admin",
      adminUser: result.admin.id,
      action: "admin.login",
      resource: "admin_auth",
      description: "Administrator login succeeded after OTP verification",
      ipAddress: req.ip,
      requestId: req.get("x-request-id"),
      status: "success",
    });
    setRefreshTokenCookie(res, result.refreshToken);
    return res.status(200).json({
      success: true,
      message: "Admin login successful",
      admin: result.admin,
      accessToken: result.accessToken,
    });
  } catch (error) {
    if (error.statusCode === 400) {
      await recordAuditEvent({
        actorType: "system",
        action: "admin.login.otp_verification",
        resource: "admin_auth",
        description: "Administrator OTP verification failed",
        ipAddress: req.ip,
        requestId: req.get("x-request-id"),
        status: "failure",
      });
    }
    return next(error);
  }
};

export const adminLoginResendOtp = async (req, res, next) => {
  try {
    const result = await resendAdminLoginOtp(req.validatedBody ?? req.body);
    return res.status(200).json({
      success: true,
      message: "A new verification code has been sent to the administrator email.",
      otpRequired: true,
      challengeId: result.challengeId,
      email: result.email,
    });
  } catch (error) {
    return next(error);
  }
};

/*
|--------------------------------------------------------------------------
| Refresh Admin Session
|--------------------------------------------------------------------------
| POST /api/v1/admin/auth/refresh
*/

export const adminRefresh = async (req, res, next) => {
  const refreshToken = req.cookies?.[REFRESH_TOKEN_COOKIE];
  if (!refreshToken) {
    return res.status(204).end();
  }

  try {
    const result = await refreshAdminSession(refreshToken);

    await recordAuditEvent({
      actorType: "admin",
      adminUser: result.admin.id,
      action: "admin.refresh",
      resource: "admin_auth",
      description: "Administrator session refreshed",
      ipAddress: req.ip,
      requestId: req.get("x-request-id"),
      status: "success",
    });
    setRefreshTokenCookie(res, result.refreshToken);

    return res.status(200).json({
      success: true,
      message: "Admin session refreshed successfully",
      admin: result.admin,
      accessToken: result.accessToken,
    });
  } catch (error) {
    if ([401, 403].includes(error.statusCode)) {
      await recordAuditEvent({
        actorType: "system",
        action: "admin.refresh",
        resource: "admin_auth",
        description: "Administrator session refresh failed",
        ipAddress: req.ip,
        requestId: req.get("x-request-id"),
        status: "failure",
      });
      clearRefreshTokenCookie(res);
      return res.status(204).end();
    }
    return next(error);
  }
};

/*
|--------------------------------------------------------------------------
| Admin Logout
|--------------------------------------------------------------------------
| POST /api/v1/admin/auth/logout
*/

export const adminLogout = async (req, res, next) => {
  try {
    const refreshToken = req.cookies?.[REFRESH_TOKEN_COOKIE];

    const adminId = await logoutAdmin(refreshToken);
    await recordAuditEvent({
      actorType: adminId ? "admin" : "system",
      adminUser: adminId,
      action: "admin.logout",
      resource: "admin_auth",
      description: "Administrator logout completed",
      ipAddress: req.ip,
      requestId: req.get("x-request-id"),
      status: "success",
    });

    clearRefreshTokenCookie(res);

    return res.status(200).json({
      success: true,
      message: "Admin logged out successfully",
    });
  } catch (error) {
    return next(error);
  }
};

/*
|--------------------------------------------------------------------------
| Get Current Admin
|--------------------------------------------------------------------------
| GET /api/v1/admin/auth/me
*/

export const getAdminMe = async (req, res, next) => {
  try {
    if (!req.admin?.adminId) {
      return res.status(401).json({
        success: false,
        message: "Admin authentication required",
      });
    }

    const admin = await getCurrentAdmin(req.admin.adminId);

    return res.status(200).json({
      success: true,
      message: "Admin profile retrieved successfully",
      admin,
    });
  } catch (error) {
    return next(error);
  }
};