import { Router } from "express";

import {
  createRazorpayPaymentOrderController,
  verifyRazorpayPaymentController,
} from "../controllers/paymentController.js";

import authMiddleware from "../middlewares/authMiddleware.js";

const router = Router();

/*
|--------------------------------------------------------------------------
| Customer Payment Routes
|--------------------------------------------------------------------------
|
| All payment endpoints require a valid customer JWT.
| Payment ownership is checked by the service.
|
*/

router.use(authMiddleware);

/*
|--------------------------------------------------------------------------
| 1. Create Razorpay Checkout Order
|--------------------------------------------------------------------------
| POST /api/v1/payments/razorpay/order
|
| Headers:
|   Idempotency-Key: unique-request-key-123
|
| Body:
|   { "orderId": "ORDER_ID" }
|--------------------------------------------------------------------------
*/

router.post(
  "/razorpay/order",
  createRazorpayPaymentOrderController
);

/*
|--------------------------------------------------------------------------
| 2. Verify Razorpay Payment
|--------------------------------------------------------------------------
| POST /api/v1/payments/razorpay/verify
|--------------------------------------------------------------------------
*/

router.post(
  "/razorpay/verify",
  verifyRazorpayPaymentController
);

export default router;