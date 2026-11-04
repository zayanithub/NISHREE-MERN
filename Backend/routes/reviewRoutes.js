import { Router } from "express";

import {
  createCustomerReviewController,
  deleteCustomerReviewController,
  listCustomerReviewsController,
  updateCustomerReviewController,
} from "../controllers/reviewController.js";

import authMiddleware from "../middlewares/authMiddleware.js";
import validate from "../middlewares/validateMiddleware.js";
import {
  createReviewSchema,
  updateReviewSchema,
} from "../validations/reviewValidation.js";

const router = Router();

router.use(authMiddleware);

router.get("/me", listCustomerReviewsController);

router.post(
  "/products/:productId",
  validate(createReviewSchema),
  createCustomerReviewController
);

router.patch(
  "/me/:reviewId",
  validate(updateReviewSchema),
  updateCustomerReviewController
);

router.delete("/me/:reviewId", deleteCustomerReviewController);

export default router;
