import jwt from "jsonwebtoken";
import AdminUser from "../models/AdminUser.js";
import { auditAdminRequest } from "../service/auditLogService.js";

const JWT_ISSUER = "nishree-attaire-api";
const JWT_AUDIENCE = "nishree-attaire-client";

const adminAuthMiddleware = async (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({
      success: false,
      message: "Authentication required. Please log in.",
    });
  }

  const token = authHeader.slice(7).trim();
  if (!token) {
    return res.status(401).json({
      success: false,
      message: "Access token is missing.",
    });
  }

  const secret = process.env.JWT_ACCESS_SECRET;
  if (!secret) {
    console.error("JWT_ACCESS_SECRET is not configured.");
    return res.status(500).json({
      success: false,
      message: "Internal server error.",
    });
  }

  try {
    const decoded = jwt.verify(token, secret, {
      issuer: JWT_ISSUER,
      audience: JWT_AUDIENCE,
      algorithms: ["HS256"],
    });

    if (
      !decoded.sub ||
      typeof decoded.sub !== "string" ||
      !/^[a-f\d]{24}$/i.test(decoded.sub) ||
      decoded.accountType !== "admin"
    ) {
      return res.status(403).json({
        success: false,
        message: "Admin access required.",
      });
    }

    const admin = await AdminUser.findById(decoded.sub)
      .select("status role")
      .populate({ path: "role", select: "isActive" });
    if (!admin || admin.status !== "active" || admin.role?.isActive !== true) {
      return res.status(403).json({
        success: false,
        message: "Admin account or role is inactive or unavailable.",
      });
    }

    req.admin = {
      adminId: decoded.sub,
      accountType: "admin",
    };
    return auditAdminRequest(req, res, next);
  } catch (error) {
    if (
      error.name === "TokenExpiredError" ||
      error.name === "JsonWebTokenError" ||
      error.name === "NotBeforeError"
    ) {
      return res.status(401).json({
        success: false,
        message: "Invalid or expired access token.",
      });
    }

    console.error("Admin authentication error:", error.message);
    return res.status(500).json({
      success: false,
      message: "Internal server error.",
    });
  }
};

export default adminAuthMiddleware;
