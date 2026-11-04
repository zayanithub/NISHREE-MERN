import { Router } from "express";

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

router.post("/login", validate(adminLoginSchema), adminLogin);
router.post("/login/verify-otp", validate(adminOtpChallengeSchema), adminLoginVerifyOtp);
router.post("/login/resend-otp", validate(adminOtpResendSchema), adminLoginResendOtp);
router.post("/refresh", adminRefresh);
router.post("/logout", adminLogout);
router.get("/me", adminAuthMiddleware, getAdminMe);

export default router;
