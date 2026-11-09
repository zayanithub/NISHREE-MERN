import { Router } from "express";
import rateLimit from "express-rate-limit";

import {
  adminLogin,
  adminLoginVerifyOtp,
  adminLoginResendOtp,
  adminRefresh,
  adminLogout,
  getAdminMe,
} from "../controllers/adminAuthController.js";

import adminAuthMiddleware from "../middlewares/adminAuthMiddleware.js";
import validate from "../middlewares/validateMiddleware.js";

import {
  adminLoginSchema,
  adminOtpChallengeSchema,
  adminOtpResendSchema,
} from "../validations/adminAuthValidation.js";

const router = Router();
const adminOtpLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  message: {
    success: false,
    message: "Too many admin sign-in attempts. Please try again later.",
  },
});

router.post("/login", adminOtpLimiter, validate(adminLoginSchema), adminLogin);
router.post("/login/verify-otp", validate(adminOtpChallengeSchema), adminLoginVerifyOtp);
router.post("/login/resend-otp", adminOtpLimiter, validate(adminOtpResendSchema), adminLoginResendOtp);
router.post("/refresh", adminRefresh);
router.post("/logout", adminLogout);
router.get("/me", adminAuthMiddleware, getAdminMe);

export default router;
