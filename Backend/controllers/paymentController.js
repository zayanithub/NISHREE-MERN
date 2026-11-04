import {
  createRazorpayPaymentOrder as createRazorpayPaymentOrderService,
  verifyRazorpayPayment as verifyRazorpayPaymentService,
} from "../service/paymentService.js";

/*
|--------------------------------------------------------------------------
| Customer Authentication Helper
|--------------------------------------------------------------------------
*/

const requireCustomer = (req, res) => {
  const userId = req.auth?.userId;

  if (
    !userId ||
    req.auth?.accountType !== "user"
  ) {
    res.status(401).json({
      success: false,
      code: "CUSTOMER_AUTHENTICATION_REQUIRED",
      message: "Customer authentication required.",
    });

    return null;
  }

  return userId;
};

/*
|--------------------------------------------------------------------------
| Request Body Validation Helper
|--------------------------------------------------------------------------
*/

const hasOnlyAllowedFields = (
  body,
  allowedFields
) => {
  if (
    !body ||
    typeof body !== "object" ||
    Array.isArray(body)
  ) {
    return false;
  }

  const keys = Object.keys(body);

  return (
    keys.length > 0 &&
    keys.every((key) => allowedFields.includes(key))
  );
};

/*
|--------------------------------------------------------------------------
| 1. Create Razorpay Checkout Order
|--------------------------------------------------------------------------
| POST /api/v1/payments/razorpay/order
|
| Required header:
| Idempotency-Key: unique-request-key-123
|
| Request body:
| {
|   "orderId": "ORDER_ID"
| }
|
| The amount is loaded from the saved order by the service.
| Client-supplied amounts are never accepted.
|--------------------------------------------------------------------------
*/

export const createRazorpayPaymentOrderController = async (
  req,
  res,
  next
) => {
  try {
    const userId = requireCustomer(req, res);

    if (!userId) {
      return;
    }

    const body = req.validatedBody ?? req.body;

    if (
      !hasOnlyAllowedFields(body, ["orderId"]) ||
      typeof body.orderId !== "string"
    ) {
      return res.status(400).json({
        success: false,
        message:
          "Request body must contain only a valid orderId.",
      });
    }

    const idempotencyKey =
      req.get("Idempotency-Key");

    const result =
      await createRazorpayPaymentOrderService(
        userId,
        body.orderId,
        idempotencyKey
      );

    return res.status(201).json({
      success: true,
      message: "Razorpay checkout initialized successfully.",
      ...result,
    });
  } catch (error) {
    return next(error);
  }
};

/*
|--------------------------------------------------------------------------
| 2. Verify Razorpay Payment
|--------------------------------------------------------------------------
| POST /api/v1/payments/razorpay/verify
|
| Request body:
| {
|   "paymentId": "DATABASE_PAYMENT_ID",
|   "razorpay_order_id": "order_...",
|   "razorpay_payment_id": "pay_...",
|   "razorpay_signature": "..."
| }
|
| The service verifies the signature and checks the payment
| directly with Razorpay before updating the order.
|--------------------------------------------------------------------------
*/

export const verifyRazorpayPaymentController = async (
  req,
  res,
  next
) => {
  try {
    const userId = requireCustomer(req, res);

    if (!userId) {
      return;
    }

    const body = req.validatedBody ?? req.body;

    const allowedFields = [
      "paymentId",
      "razorpay_order_id",
      "razorpay_payment_id",
      "razorpay_signature",
    ];

    if (
      !hasOnlyAllowedFields(
        body,
        allowedFields
      ) ||
      allowedFields.some(
        (field) =>
          typeof body[field] !== "string" ||
          !body[field].trim()
      )
    ) {
      return res.status(400).json({
        success: false,
        message:
          "Payment verification requires paymentId, razorpay_order_id, razorpay_payment_id, and razorpay_signature.",
      });
    }

    const result =
      await verifyRazorpayPaymentService(
        userId,
        body
      );

    return res.status(200).json({
      success: true,
      message: result.alreadyVerified
        ? "Payment was already verified."
        : "Payment verification completed.",
      ...result,
    });
  } catch (error) {
    return next(error);
  }
};