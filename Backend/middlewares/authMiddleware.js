import jwt from "jsonwebtoken";

const authMiddleware = (req, res, next) => {
  const authorization = req.headers.authorization;
  const secret = process.env.JWT_ACCESS_SECRET;

  if (!secret) {
    return next(new Error("JWT_ACCESS_SECRET is missing"));
  }

  if (!authorization?.startsWith("Bearer ")) {
    return res.status(401).json({
      success: false,
      code: "AUTHENTICATION_REQUIRED",
      message: "Authentication required",
    });
  }

  const token = authorization.slice(7);

  try {
    const payload = jwt.verify(token, secret, {
      issuer: "nishree-attaire-api",
      audience: "nishree-attaire-client",
    });

    if (
      typeof payload === "string" ||
      payload.accountType !== "user" ||
      typeof payload.sub !== "string"
    ) {
      return res.status(403).json({
        success: false,
        message: "Customer access required",
      });
    }

    req.auth = {
      userId: payload.sub,
      accountType: payload.accountType,
    };

    return next();
  } catch {
    return res.status(401).json({
      success: false,
      code: "ACCESS_TOKEN_INVALID",
      message: "Access token is invalid or expired",
    });
  }
};

export default authMiddleware;