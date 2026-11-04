import { Router } from "express";

import {
  createAdminCouponController,
  deleteAdminCouponController,
  getAdminCouponController,
  listAdminCouponsController,
  updateAdminCouponController,
  updateAdminCouponStatusController,
} from "../../controllers/couponController.js";

import adminAuthMiddleware from "../../middlewares/adminAuthMiddleware.js";
import requirePermission from "../../middlewares/requirePermission.js";
import validate from "../../middlewares/validateMiddleware.js";
import {
  createCouponSchema,
  updateCouponSchema,
  updateCouponStatusSchema,
} from "../../validations/couponValidation.js";

const router = Router();

router.use(adminAuthMiddleware);

router.get(
  "/",
  requirePermission("coupons", "read"),
  listAdminCouponsController
);

router.post(
  "/",
  requirePermission("coupons", "create"),
  validate(createCouponSchema),
  createAdminCouponController
);

router.patch(
  "/:couponId/status",
  requirePermission("coupons", "update"),
  validate(updateCouponStatusSchema),
  updateAdminCouponStatusController
);

router.patch(
  "/:couponId",
  requirePermission("coupons", "update"),
  validate(updateCouponSchema),
  updateAdminCouponController
);

router.delete(
  "/:couponId",
  requirePermission("coupons", "delete"),
  deleteAdminCouponController
);

router.get(
  "/:couponId",
  requirePermission("coupons", "read"),
  getAdminCouponController
);

export default router;
