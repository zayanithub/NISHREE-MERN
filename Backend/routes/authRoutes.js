import { Router } from "express";

import {
  register,
  login,
  verifyLoginOtp,
  verifyRegistrationEmail,
  forgotPassword,
  verifyForgotPasswordOtp,
  resetPassword,
  refresh,
  logout,
  getMe,
} from "../controllers/authController.js";

import authMiddleware from "../middlewares/authMiddleware.js";
import { uploadProfileImage } from "../middlewares/profileImageUpload.js";
import { saveProfileImage, removeProfileImage } from "../controllers/profileImageController.js";
import validate from "../middlewares/validateMiddleware.js";

import {
  registerSchema,
  loginSchema,
  otpChallengeSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
} from "../validations/authValidation.js";
import rateLimit from "express-rate-limit";

const router = Router();

const authChallengeLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  message: {
    success: false,
    message: "Too many authentication attempts. Please try again later.",
  },
});

router.post("/register", authChallengeLimiter, validate(registerSchema), register);
router.post("/login", authChallengeLimiter, validate(loginSchema), login);
router.post("/login/verify-otp", authChallengeLimiter, validate(otpChallengeSchema), verifyLoginOtp);
router.post("/register/verify-email", authChallengeLimiter, validate(otpChallengeSchema), verifyRegistrationEmail);
router.post("/forgot-password", authChallengeLimiter, validate(forgotPasswordSchema), forgotPassword);
router.post("/forgot-password/verify-otp", authChallengeLimiter, validate(otpChallengeSchema), verifyForgotPasswordOtp);
router.post("/forgot-password/reset", authChallengeLimiter, validate(resetPasswordSchema), resetPassword);
router.post("/refresh", refresh);
router.post("/logout", logout);
router.get("/me", authMiddleware, getMe);
router.post("/me/profile-image", authMiddleware, uploadProfileImage, saveProfileImage);
router.delete("/me/profile-image", authMiddleware, removeProfileImage);

export default router;
