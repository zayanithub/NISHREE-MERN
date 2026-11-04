import { Router } from "express";

import { listPublicOffersController, validateCouponController } from "../controllers/couponController.js";
import authMiddleware from "../middlewares/authMiddleware.js";
import validate from "../middlewares/validateMiddleware.js";
import { validateCouponSchema } from "../validations/couponValidation.js";

const router = Router();

router.get("/offers", listPublicOffersController);
router.use(authMiddleware);

router.post(
  "/validate",
  validate(validateCouponSchema),
  validateCouponController
);

export default router;
