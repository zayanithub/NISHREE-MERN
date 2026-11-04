import Razorpay from "razorpay";
import {
  createHmac,
  timingSafeEqual,
} from "node:crypto";

import Payment from "../models/Payment.js";
import Order from "../models/Order.js";
import { redeemCouponForOrder } from "./couponService.js";
import { emitCustomerNotification } from "./notificationService.js";

/*
|--------------------------------------------------------------------------
| Common Helpers
|--------------------------------------------------------------------------
*/

class PaymentServiceError extends Error {
  constructor(message, statusCode) {
    super(message);
    this.name = "PaymentServiceError";
    this.statusCode = statusCode;
  }
}

const createError = (message, statusCode) =>
  new PaymentServiceError(message, statusCode);

const isValidObjectId = (value) => {
  return (
    typeof value === "string" &&
    /^[a-f\d]{24}$/i.test(value)
  );
};

const validateObjectId = (value, fieldName) => {
  if (!isValidObjectId(String(value ?? ""))) {
    throw createError(
      `Invalid ${fieldName}.`,
      400
    );
  }

  return String(value);
};

const validateUserId = (userId) => {
  return validateObjectId(
    userId,
    "customer ID"
  );
};

const rupeesToPaise = (amount) => {
  const numericAmount = Number(amount);

  if (
    !Number.isFinite(numericAmount) ||
    numericAmount <= 0
  ) {
    throw createError(
      "Payment amount must be greater than zero.",
      400
    );
  }

  const paise = Math.round(
    numericAmount * 100
  );

  if (!Number.isSafeInteger(paise) || paise <= 0) {
    throw createError(
      "Invalid payment amount.",
      400
    );
  }

  return paise;
};

/*
|--------------------------------------------------------------------------
| Razorpay Configuration
|--------------------------------------------------------------------------
|
| Required environment variables:
| RAZORPAY_KEY_ID
| RAZORPAY_KEY_SECRET
|
| Never send the secret key to the frontend or return it
| in any API response.
|--------------------------------------------------------------------------
*/

const getRazorpayClient = () => {
  const keyId = process.env.RAZORPAY_KEY_ID;
  const keySecret = process.env.RAZORPAY_KEY_SECRET;

  if (!keyId || !keySecret) {
    throw createError(
      "Razorpay configuration is missing.",
      503
    );
  }

  return new Razorpay({
    key_id: keyId,
    key_secret: keySecret,
  });
};

/*
|--------------------------------------------------------------------------
| Public Payment Response
|--------------------------------------------------------------------------
|
| Never expose signature, idempotency key, or the Razorpay
| secret key through the API response.
|--------------------------------------------------------------------------
*/

const formatPublicPayment = (payment) => {
  return {
    _id: String(payment._id),
    order: String(payment.order),
    paymentMethod: payment.paymentMethod,
    paymentProvider: payment.paymentProvider,
    amount: payment.amount,
    currency: payment.currency,
    status: payment.status,
    razorpayOrderId: payment.razorpayOrderId ?? null,
    razorpayPaymentId: payment.razorpayPaymentId ?? null,
    signatureVerified: payment.signatureVerified,
    paidAt: payment.paidAt,
    failedAt: payment.failedAt,
    failureCode: payment.failureCode,
    failureMessage: payment.failureMessage,
    createdAt: payment.createdAt,
    updatedAt: payment.updatedAt,
  };
};

const buildCheckoutResponse = (payment) => {
  const keyId = process.env.RAZORPAY_KEY_ID;

  if (
    !keyId ||
    !process.env.RAZORPAY_KEY_SECRET ||
    !payment.razorpayOrderId
  ) {
    throw createError(
      "Razorpay checkout is not available for this payment.",
      503
    );
  }

  return {
    payment: formatPublicPayment(payment),

    checkout: {
      keyId,
      orderId: payment.razorpayOrderId,
      amount: rupeesToPaise(payment.amount),
      currency: payment.currency,
    },
  };
};

/*
|--------------------------------------------------------------------------
| Idempotency Key Validation
|--------------------------------------------------------------------------
|
| The frontend must reuse the same key when retrying the
| same create-payment request.
|--------------------------------------------------------------------------
*/

const validateIdempotencyKey = (value) => {
  if (
    typeof value !== "string" ||
    value.length < 8 ||
    value.length > 128 ||
    !/^[A-Za-z0-9._:-]+$/.test(value)
  ) {
    throw createError(
      "A valid Idempotency-Key header is required.",
      400
    );
  }

  return value;
};

/*
|--------------------------------------------------------------------------
| 1. Create Razorpay Payment Order
|--------------------------------------------------------------------------
|
| Input:
|   userId
|   orderId
|   idempotencyKey
|
| The amount is always fetched from the saved order.
| Frontend-supplied amount is never accepted.
|--------------------------------------------------------------------------
*/

export const createRazorpayPaymentOrder = async (
  userId,
  orderId,
  idempotencyKey
) => {
  const validatedUserId =
    validateUserId(userId);

  const validatedOrderId =
    validateObjectId(
      orderId,
      "order ID"
    );

  const validatedIdempotencyKey =
    validateIdempotencyKey(idempotencyKey);

  /*
   * Repeated request with the same idempotency key.
   */
  const existingIdempotentPayment =
    await Payment.findOne({
      idempotencyKey: validatedIdempotencyKey,
    });

  if (existingIdempotentPayment) {
    if (
      String(existingIdempotentPayment.user) !==
        validatedUserId ||
      String(existingIdempotentPayment.order) !==
        validatedOrderId
    ) {
      throw createError(
        "This idempotency key has already been used for another payment request.",
        409
      );
    }

    if (
      existingIdempotentPayment.status === "pending" &&
      existingIdempotentPayment.razorpayOrderId
    ) {
      return buildCheckoutResponse(
        existingIdempotentPayment
      );
    }

    if (
      existingIdempotentPayment.status === "captured"
    ) {
      throw createError(
        "This payment has already been captured.",
        409
      );
    }

    if (
      existingIdempotentPayment.status === "authorized"
    ) {
      throw createError(
        "This payment is already authorized. Check its status before retrying.",
        409
      );
    }

    if (
      existingIdempotentPayment.status === "failed" ||
      existingIdempotentPayment.status === "cancelled"
    ) {
      throw createError(
        "This payment attempt has ended. Use a new idempotency key for a new attempt.",
        409
      );
    }

    throw createError(
      "Payment initialization is already in progress. Please retry shortly.",
      409
    );
  }

  /*
   * Only the authenticated customer's own order can be paid.
   */
  const order = await Order.findOne({
    _id: validatedOrderId,
    user: validatedUserId,
  });

  if (!order) {
    throw createError(
      "Order not found.",
      404
    );
  }

  if (order.paymentMethod !== "razorpay") {
    throw createError(
      "This order was not created for Razorpay payment.",
      409
    );
  }

  if (order.orderStatus !== "pending_payment") {
    throw createError(
      "This order is not waiting for payment.",
      409
    );
  }

  if (
    ["paid", "partially_refunded", "refunded"].includes(
      order.paymentStatus
    )
  ) {
    throw createError(
      "This order already has a completed payment.",
      409
    );
  }

  if (
    !["pending", "failed"].includes(
      order.paymentStatus
    )
  ) {
    throw createError(
      "This order is not eligible for a new payment attempt.",
      409
    );
  }

  const amountInPaise = rupeesToPaise(
    order.totalAmount
  );

  /*
   * If there is already an active payment attempt, reuse it.
   * This helps prevent separate checkout orders being created
   * for repeated requests against the same order.
   */
  const activePayment = await Payment.findOne({
    order: order._id,
    user: validatedUserId,
    paymentProvider: "razorpay",
    status: {
      $in: ["created", "pending", "authorized"],
    },
  }).sort({
    createdAt: -1,
  });

  if (activePayment) {
    if (
      activePayment.status === "pending" &&
      activePayment.razorpayOrderId
    ) {
      return buildCheckoutResponse(activePayment);
    }

    if (activePayment.status === "authorized") {
      throw createError(
        "A payment is already authorized. Verify its final status before retrying.",
        409
      );
    }

    throw createError(
      "Another payment initialization is in progress.",
      409
    );
  }

  const razorpay = getRazorpayClient();

  /*
   * Save our payment attempt before calling Razorpay.
   */
  let payment;

  try {
    payment = await Payment.create({
      order: order._id,
      user: validatedUserId,
      paymentMethod: "razorpay",
      paymentProvider: "razorpay",
      amount: order.totalAmount,
      currency: "INR",
      status: "created",
      idempotencyKey: validatedIdempotencyKey,
    });
  } catch (error) {
    if (error.code === 11000) {
      const duplicatePayment =
        await Payment.findOne({
          idempotencyKey: validatedIdempotencyKey,
        });

      if (
        duplicatePayment &&
        String(duplicatePayment.user) ===
          validatedUserId &&
        String(duplicatePayment.order) ===
          validatedOrderId &&
        duplicatePayment.status === "pending" &&
        duplicatePayment.razorpayOrderId
      ) {
        return buildCheckoutResponse(
          duplicatePayment
        );
      }

      throw createError(
        "A duplicate payment request was detected. Please retry safely.",
        409
      );
    }

    throw error;
  }

  /*
   * Create the gateway order using the saved order total.
   */
  let gatewayOrder;

  try {
    gatewayOrder = await razorpay.orders.create({
      amount: amountInPaise,
      currency: "INR",
      receipt: `nia_${payment._id}`,
      notes: {
        orderId: String(order._id),
        paymentId: String(payment._id),
        orderNumber: order.orderNumber,
      },
    });

    payment.razorpayOrderId = gatewayOrder.id;
    payment.status = "pending";

    payment.metadata = {
      gatewayOrderStatus: gatewayOrder.status,
    };

    await payment.save();

    return buildCheckoutResponse(payment);
  } catch (error) {
    /*
     * Record a failed initialization so it can be investigated
     * and retried using a new idempotency key.
     */
    payment.status = "failed";
    payment.failedAt = new Date();
    payment.failureCode =
      "RAZORPAY_ORDER_CREATION_FAILED";
    payment.failureMessage =
      "Unable to initialize the online payment.";

    await payment.save().catch((saveError) => {
      console.error("Could not persist failed Razorpay initialization:", {
        message: saveError?.message || "Unknown persistence error",
        code: saveError?.code,
      });
    });

    await Order.updateOne(
      {
        _id: order._id,
        user: validatedUserId,
        orderStatus: "pending_payment",
        paymentStatus: {
          $in: ["pending", "failed"],
        },
      },
      {
        $set: {
          paymentStatus: "failed",
        },
      }
    );

    if (error instanceof PaymentServiceError) {
      throw error;
    }

    const isRazorpayAuthenticationFailure =
      Number(error?.statusCode) === 401;

    console.error("Razorpay order creation failed:", {
      message:
        error?.error?.description ||
        error?.error?.reason ||
        error?.message ||
        "Unknown Razorpay provider error",
      code: error?.code || error?.error?.code,
      statusCode: error?.statusCode,
    });
    throw createError(
      isRazorpayAuthenticationFailure
        ? "Razorpay rejected the server credentials. Configure a matching key ID and secret from the same Razorpay environment."
        : "Unable to initialize Razorpay checkout. Please retry with a new idempotency key.",
      502
    );
  }
};

/*
|--------------------------------------------------------------------------
| Payment Signature Verification
|--------------------------------------------------------------------------
|
| HMAC-SHA256 input:
| server-stored Razorpay order ID + "|" + Razorpay payment ID.
|--------------------------------------------------------------------------
*/

const verifyPaymentSignature = (
  storedOrderId,
  razorpayPaymentId,
  suppliedSignature,
  secret
) => {
  if (
    typeof suppliedSignature !== "string" ||
    !/^[a-f\d]{64}$/i.test(suppliedSignature)
  ) {
    return false;
  }

  const expectedSignature = createHmac(
    "sha256",
    secret
  )
    .update(
      `${storedOrderId}|${razorpayPaymentId}`
    )
    .digest("hex");

  const expectedBuffer = Buffer.from(
    expectedSignature,
    "hex"
  );

  const suppliedBuffer = Buffer.from(
    suppliedSignature,
    "hex"
  );

  if (
    expectedBuffer.length !== suppliedBuffer.length
  ) {
    return false;
  }

  return timingSafeEqual(
    expectedBuffer,
    suppliedBuffer
  );
};

/*
|--------------------------------------------------------------------------
| 2. Verify Razorpay Payment
|--------------------------------------------------------------------------
|
| Verifies:
| 1. Payment belongs to the authenticated customer.
| 2. Supplied gateway order ID matches the stored ID.
| 3. HMAC signature is valid.
| 4. Payment details fetched from Razorpay match the order.
| 5. Captured status is required before marking the order paid.
|--------------------------------------------------------------------------
*/

export const verifyRazorpayPayment = async (
  userId,
  data
) => {
  const validatedUserId =
    validateUserId(userId);

  if (
    !data ||
    typeof data !== "object" ||
    Array.isArray(data)
  ) {
    throw createError(
      "Payment verification data is required.",
      400
    );
  }

  const paymentId = validateObjectId(
    data.paymentId,
    "payment ID"
  );

  const razorpayOrderId =
    typeof data.razorpay_order_id === "string"
      ? data.razorpay_order_id.trim()
      : "";

  const razorpayPaymentId =
    typeof data.razorpay_payment_id === "string"
      ? data.razorpay_payment_id.trim()
      : "";

  const suppliedSignature =
    data.razorpay_signature;

  if (
    !razorpayOrderId ||
    !razorpayPaymentId ||
    typeof suppliedSignature !== "string"
  ) {
    throw createError(
      "Razorpay verification fields are required.",
      400
    );
  }

  const payment = await Payment.findOne({
    _id: paymentId,
    user: validatedUserId,
    paymentProvider: "razorpay",
  }).select("+razorpaySignature");

  if (!payment) {
    throw createError(
      "Payment not found.",
      404
    );
  }

  if (
    !payment.razorpayOrderId ||
    payment.razorpayOrderId !== razorpayOrderId
  ) {
    throw createError(
      "Razorpay order ID does not match the stored payment.",
      400
    );
  }

  const order = await Order.findOne({
    _id: payment.order,
    user: validatedUserId,
  });

  if (!order) {
    throw createError(
      "Order not found.",
      404
    );
  }

  const keySecret =
    process.env.RAZORPAY_KEY_SECRET;

  if (!keySecret) {
    throw createError(
      "Razorpay configuration is missing.",
      503
    );
  }

  const signatureIsValid =
    verifyPaymentSignature(
      payment.razorpayOrderId,
      razorpayPaymentId,
      suppliedSignature,
      keySecret
    );

  if (!signatureIsValid) {
    throw createError(
      "Razorpay payment signature is invalid.",
      400
    );
  }

  /*
   * Fetch payment status directly from Razorpay.
   * Do not trust the frontend's success result alone.
   */
  const razorpay = getRazorpayClient();

  let gatewayPayment;

  try {
    gatewayPayment =
      await razorpay.payments.fetch(
        razorpayPaymentId
      );
  } catch (error) {
    console.error("Razorpay payment lookup failed:", {
      message: error?.message || "Unknown Razorpay provider error",
      code: error?.code || error?.error?.code,
      statusCode: error?.statusCode,
    });
    throw createError(
      "Unable to verify payment status with Razorpay. Please retry.",
      502
    );
  }

  const expectedAmount = rupeesToPaise(
    payment.amount
  );

  if (
    gatewayPayment.order_id !==
      payment.razorpayOrderId ||
    Number(gatewayPayment.amount) !==
      expectedAmount ||
    gatewayPayment.currency !== "INR"
  ) {
    throw createError(
      "Gateway payment details do not match the stored payment.",
      409
    );
  }

  if (
    payment.status === "captured" &&
    payment.razorpayPaymentId ===
      razorpayPaymentId
  ) {
    if (
      order.paymentStatus === "paid" &&
      order.orderStatus === "confirmed"
    ) {
      await redeemCouponForOrder(order._id);
      await emitCustomerNotification({
        recipientId: validatedUserId,
        type: "payment",
        title: "Payment successful",
        message: `Payment for order ${order.orderNumber} was successful.`,
        relatedOrder: order._id,
        actionUrl: `/orders/${order._id}`,
        idempotencyKey: `payment.captured:${payment._id}`,
      });
      return {
        payment: formatPublicPayment(payment),
        order: order.toObject(),
        alreadyVerified: true,
      };
    }
  }

  /*
   * Payment is authorized but not yet captured.
   * Do not mark the order as paid.
   */
  if (gatewayPayment.status === "authorized") {
    payment.status = "authorized";
    payment.razorpayPaymentId =
      razorpayPaymentId;
    payment.razorpaySignature =
      suppliedSignature;
    payment.signatureVerified = true;

    await payment.save();

    await Order.updateOne(
      {
        _id: order._id,
        user: validatedUserId,
        paymentMethod: "razorpay",
        orderStatus: {
          $in: ["pending_payment", "confirmed"],
        },
        paymentStatus: {
          $in: [
            "pending",
            "authorized",
            "failed",
          ],
        },
      },
      {
        $set: {
          paymentStatus: "authorized",
        },
      }
    );

    return {
      payment: formatPublicPayment(payment),
      order: await Order.findById(order._id).lean(),
      alreadyVerified: false,
    };
  }

  /*
   * Record failed attempts so the customer can retry
   * with a new payment attempt and idempotency key.
   */
  if (gatewayPayment.status === "failed") {
    payment.status = "failed";
    payment.razorpayPaymentId =
      razorpayPaymentId;
    payment.razorpaySignature =
      suppliedSignature;
    payment.signatureVerified = true;
    payment.failedAt = new Date();
    payment.failureCode =
      gatewayPayment.error_code || "PAYMENT_FAILED";
    payment.failureMessage =
      "Razorpay reported that the payment failed.";

    await payment.save();

    await Order.updateOne(
      {
        _id: order._id,
        user: validatedUserId,
        orderStatus: "pending_payment",
        paymentStatus: {
          $in: ["pending", "failed"],
        },
      },
      {
        $set: {
          paymentStatus: "failed",
        },
      }
    );

    await emitCustomerNotification({
      recipientId: validatedUserId,
      type: "payment",
      title: "Payment failed",
      message: `Payment for order ${order.orderNumber} failed. You can retry payment from your order.`,
      relatedOrder: order._id,
      actionUrl: `/orders/${order._id}`,
      idempotencyKey: `payment.failed:${payment._id}`,
    });

    throw createError(
      "Razorpay payment was not successful. You may retry payment.",
      409
    );
  }

  if (gatewayPayment.status !== "captured") {
    throw createError(
      "Payment has not been captured yet.",
      409
    );
  }

  /*
   * Persist the actual captured payment.
   * If order reconciliation fails afterward, the captured
   * payment remains recorded for investigation.
   */
  payment.status = "captured";
  payment.razorpayPaymentId =
    razorpayPaymentId;
  payment.razorpaySignature =
    suppliedSignature;
  payment.signatureVerified = true;
  payment.paidAt =
    payment.paidAt || new Date();
  payment.failedAt = null;
  payment.failureCode = null;
  payment.failureMessage = null;

  try {
    await payment.save();
  } catch (error) {
    if (error.code === 11000) {
      throw createError(
        "This Razorpay payment ID has already been recorded.",
        409
      );
    }

    throw error;
  }

  /*
   * Do not silently charge the same order twice.
   * Record the second captured payment and flag it for review.
   */
  const otherCapturedPayment =
    await Payment.findOne({
      order: order._id,
      status: "captured",
      _id: {
        $ne: payment._id,
      },
    }).lean();

  if (otherCapturedPayment) {
    throw createError(
      "Another payment is already captured for this order. The additional captured payment requires reconciliation.",
      409
    );
  }

  const now = new Date();

  const updatedOrder =
    await Order.findOneAndUpdate(
      {
        _id: order._id,
        user: validatedUserId,
        paymentMethod: "razorpay",
        orderStatus: {
          $in: ["pending_payment", "confirmed"],
        },
        paymentStatus: {
          $in: [
            "pending",
            "authorized",
            "failed",
            "paid",
          ],
        },
      },
      {
        $set: {
          paymentStatus: "paid",
          orderStatus: "confirmed",
          confirmedAt: order.confirmedAt || now,
        },
      },
      {
        returnDocument: "after",
        runValidators: true,
      }
    );

  if (!updatedOrder) {
    const latestOrder = await Order.findOne({
      _id: order._id,
      user: validatedUserId,
    }).lean();

    if (
      latestOrder?.paymentStatus === "paid" &&
      latestOrder?.orderStatus === "confirmed"
    ) {
      await redeemCouponForOrder(order._id);
      return {
        payment: formatPublicPayment(payment),
        order: latestOrder,
        alreadyVerified: true,
      };
    }

    throw createError(
      "Payment was captured, but the order could not be updated automatically. Manual reconciliation is required.",
      409
    );
  }

  await redeemCouponForOrder(updatedOrder._id);

  await emitCustomerNotification({
    recipientId: validatedUserId,
    type: "payment",
    title: "Payment successful",
    message: `Payment for order ${updatedOrder.orderNumber} was successful.`,
    relatedOrder: updatedOrder._id,
    actionUrl: `/orders/${updatedOrder._id}`,
    idempotencyKey: `payment.captured:${payment._id}`,
  });

  return {
    payment: formatPublicPayment(payment),
    order: updatedOrder.toObject(),
    alreadyVerified: false,
  };
};