import { Router } from "express";

import {
  getAdminReviewController,
  listAdminReviewsController,
  moderateReviewController,
} from "../../controllers/adminReviewController.js";

import adminAuthMiddleware from "../../middlewares/adminAuthMiddleware.js";
import requirePermission from "../../middlewares/requirePermission.js";
import validate from "../../middlewares/validateMiddleware.js";
import { moderateReviewSchema } from "../../validations/reviewValidation.js";

const router = Router();

router.use(adminAuthMiddleware);

router.get(
  "/",
  requirePermission("reviews", "read"),
  listAdminReviewsController
);

router.get(
  "/:reviewId",
  requirePermission("reviews", "read"),
  getAdminReviewController
);

router.patch(
  "/:reviewId/moderate",
  requirePermission("reviews", "update"),
  validate(moderateReviewSchema),
  moderateReviewController
);

export default router;
