import {
  createHmac,
  timingSafeEqual,
} from "node:crypto";
import mongoose from "mongoose";

import Payment from "../models/Payment.js";
import Order from "../models/Order.js";
import RazorpayWebhookEvent from "../models/RazorpayWebhookEvent.js";
import Refund from "../models/Refund.js";
import ReturnRequest from "../models/ReturnRequest.js";
import {
  completeReturnExchangeQuantity,
} from "./returnExchangeReservationService.js";
import { emitCustomerNotification } from "./notificationService.js";

/*
|--------------------------------------------------------------------------
| Common Helpers
|--------------------------------------------------------------------------
*/

const createError = (message, statusCode) => {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
};

const toPaise = (rupees) => {
  const amount = Number(rupees);

  if (!Number.isFinite(amount) || amount < 0) {
    throw createError(
      "Invalid payment amount in database.",
      500
    );
  }

  const paise = Math.round(amount * 100);

  if (!Number.isSafeInteger(paise)) {
    throw createError(
      "Payment amount exceeds the supported range.",
      500
    );
  }

  return paise;
};

const roundMoney = (value) => {
  return Math.round(
    (Number(value) + Number.EPSILON) * 100
  ) / 100;
};

/*
|--------------------------------------------------------------------------
| Webhook Secret
|--------------------------------------------------------------------------
*/

const getWebhookSecret = () => {
  const secret = process.env.RAZORPAY_WEBHOOK_SECRET;

  if (!secret) {
    throw createError(
      "RAZORPAY_WEBHOOK_SECRET is not configured.",
      503
    );
  }

  return secret;
};

/*
|--------------------------------------------------------------------------
| Verify Raw-Body Signature
|--------------------------------------------------------------------------
*/

const verifyWebhookSignature = (
  rawBody,
  suppliedSignature,
  secret
) => {
  if (
    !Buffer.isBuffer(rawBody) ||
    typeof suppliedSignature !== "string" ||
    !/^[a-f\d]{64}$/i.test(suppliedSignature)
  ) {
    return false;
  }

  const expectedSignature = createHmac(
    "sha256",
    secret
  )
    .update(rawBody)
    .digest();

  const receivedSignature = Buffer.from(
    suppliedSignature,
    "hex"
  );

  if (
    expectedSignature.length !==
    receivedSignature.length
  ) {
    return false;
  }

  return timingSafeEqual(
    expectedSignature,
    receivedSignature
  );
};

/*
|--------------------------------------------------------------------------
| Extract Webhook Entities
|--------------------------------------------------------------------------
*/

const getPaymentEntity = (payload) => {
  return payload?.payload?.payment?.entity ?? null;
};

const getRefundEntity = (payload) => {
  return payload?.payload?.refund?.entity ?? null;
};

/*
|--------------------------------------------------------------------------
| Event Claiming / Idempotency
|--------------------------------------------------------------------------
*/

const claimWebhookEvent = async ({
  eventId,
  eventType,
  paymentEntity,
  refundEntity = null,
}) => {
  const eventData = {
    eventId,
    eventType,
    razorpayPaymentId:
      paymentEntity?.id ??
      refundEntity?.payment_id ??
      null,
    razorpayOrderId:
      paymentEntity?.order_id ?? null,
    status: "processing",
    signatureVerified: true,
    attempts: 1,
    lastError: null,
  };

  try {
    return {
      event: await RazorpayWebhookEvent.create(
        eventData
      ),
      duplicate: false,
    };
  } catch (error) {
    if (error.code !== 11000) {
      throw error;
    }
  }

  const existing = await RazorpayWebhookEvent.findOne({
    eventId,
  });

  if (!existing) {
    throw createError(
      "Webhook event could not be claimed. Retry delivery.",
      503
    );
  }

  if (existing.status === "processed") {
    return {
      event: existing,
      duplicate: true,
    };
  }

  const fiveMinutes = 5 * 60 * 1000;

  const processingIsStale =
    existing.status === "processing" &&
    Date.now() -
      new Date(existing.updatedAt).getTime() >
      fiveMinutes;

  const mayRetry =
    existing.status === "failed" ||
    existing.status === "received" ||
    processingIsStale;

  if (!mayRetry) {
    throw createError(
      "This webhook event is already being processed. Retry delivery shortly.",
      503
    );
  }

  const claimed = await RazorpayWebhookEvent.findOneAndUpdate(
    {
      _id: existing._id,
      status: existing.status,
      updatedAt: existing.updatedAt,
    },
    {
      $set: {
        eventType,
        razorpayPaymentId:
          paymentEntity?.id ??
          refundEntity?.payment_id ??
          null,
        razorpayOrderId:
          paymentEntity?.order_id ?? null,
        status: "processing",
        signatureVerified: true,
        lastError: null,
      },
      $inc: {
        attempts: 1,
      },
    },
    {
      returnDocument: "after",
      runValidators: true,
    }
  );

  if (!claimed) {
    throw createError(
      "Webhook event is being processed by another request. Retry delivery.",
      503
    );
  }

  return {
    event: claimed,
    duplicate: false,
  };
};

/*
|--------------------------------------------------------------------------
| Find Matching Local Payment
|--------------------------------------------------------------------------
*/

const getMatchingPayment = async (paymentEntity) => {
  if (
    !paymentEntity ||
    typeof paymentEntity.id !== "string" ||
    typeof paymentEntity.order_id !== "string"
  ) {
    throw createError(
      "Webhook does not contain a valid Razorpay payment entity.",
      400
    );
  }

  const payment = await Payment.findOne({
    razorpayOrderId: paymentEntity.order_id,
    paymentProvider: "razorpay",
  });

  if (!payment) {
    throw createError(
      "No local payment matches this Razorpay order.",
      404
    );
  }

  if (
    Number(paymentEntity.amount) !==
      toPaise(payment.amount) ||
    paymentEntity.currency !== payment.currency
  ) {
    throw createError(
      "Webhook payment amount or currency does not match the stored payment.",
      409
    );
  }

  return payment;
};

/*
|--------------------------------------------------------------------------
| Update Payment Metadata
|--------------------------------------------------------------------------
*/

const recordWebhookMetadata = (
  payment,
  eventId,
  eventType
) => {
  const existingMetadata =
    payment.metadata &&
    typeof payment.metadata === "object" &&
    !Array.isArray(payment.metadata)
      ? payment.metadata
      : {};

  payment.metadata = {
    ...existingMetadata,
    lastWebhookEventId: eventId,
    lastWebhookEventType: eventType,
  };
};

/*
|--------------------------------------------------------------------------
| Handle payment.authorized
|--------------------------------------------------------------------------
*/

const handlePaymentAuthorized = async ({
  payment,
  order,
  paymentEntity,
  eventId,
  eventType,
}) => {
  if (
    [
      "captured",
      "partially_refunded",
      "refunded",
    ].includes(payment.status)
  ) {
    return;
  }

  payment.status = "authorized";
  payment.razorpayPaymentId = paymentEntity.id;

  recordWebhookMetadata(
    payment,
    eventId,
    eventType
  );

  await payment.save();

  if (
    order.orderStatus === "pending_payment" &&
    [
      "pending",
      "failed",
      "authorized",
    ].includes(order.paymentStatus)
  ) {
    order.paymentStatus = "authorized";
    await order.save();
  }
};

/*
|--------------------------------------------------------------------------
| Handle payment.captured
|--------------------------------------------------------------------------
*/

const handlePaymentCaptured = async ({
  payment,
  order,
  paymentEntity,
  eventId,
  eventType,
}) => {
  const paymentIdOwner = await Payment.findOne({
    razorpayPaymentId: paymentEntity.id,
    _id: {
      $ne: payment._id,
    },
  }).select("_id");

  if (paymentIdOwner) {
    throw createError(
      "This Razorpay payment ID is already attached to another payment record.",
      409
    );
  }

  if (
    !(
      payment.status === "captured" &&
      payment.razorpayPaymentId === paymentEntity.id
    )
  ) {
    payment.status = "captured";
    payment.razorpayPaymentId = paymentEntity.id;
    payment.paidAt =
      payment.paidAt || new Date();
    payment.failedAt = null;
    payment.failureCode = null;
    payment.failureMessage = null;

    recordWebhookMetadata(
      payment,
      eventId,
      eventType
    );

    await payment.save();
  }

  /*
   * A captured payment arriving after cancellation needs
   * reconciliation. Do not silently reconfirm the order.
   */
  if (order.orderStatus === "cancelled") {
    order.paymentStatus = "paid";

    order.notes = [
      order.notes || "",
      `[Payment reconciliation required: Razorpay captured payment ${paymentEntity.id} after order cancellation.]`,
    ]
      .filter(Boolean)
      .join("\n")
      .slice(0, 1000);

    await order.save();

    payment.metadata = {
      ...(payment.metadata || {}),
      reconciliationRequired: true,
      reconciliationReason:
        "payment_captured_after_order_cancellation",
    };

    await payment.save();

    return;
  }

  order.paymentStatus = "paid";

  if (order.orderStatus === "pending_payment") {
    order.orderStatus = "confirmed";
    order.confirmedAt =
      order.confirmedAt || new Date();
  }

  await order.save();
};

/*
|--------------------------------------------------------------------------
| Handle payment.failed
|--------------------------------------------------------------------------
*/

const handlePaymentFailed = async ({
  payment,
  order,
  paymentEntity,
  eventId,
  eventType,
}) => {
  if (
    [
      "captured",
      "partially_refunded",
      "refunded",
    ].includes(payment.status)
  ) {
    return;
  }

  payment.status = "failed";
  payment.razorpayPaymentId = paymentEntity.id;
  payment.failedAt = new Date();
  payment.failureCode =
    paymentEntity.error_code || "PAYMENT_FAILED";

  payment.failureMessage = String(
    paymentEntity.error_description ||
    paymentEntity.error_reason ||
    "Razorpay reported that the payment failed."
  ).slice(0, 500);

  recordWebhookMetadata(
    payment,
    eventId,
    eventType
  );

  await payment.save();

  /*
   * Preserve reserved inventory so the customer can retry.
   */
  if (
    order.orderStatus === "pending_payment" &&
    [
      "pending",
      "failed",
      "authorized",
    ].includes(order.paymentStatus)
  ) {
    order.paymentStatus = "failed";
    await order.save();
  }
};

/*
|--------------------------------------------------------------------------
| Find Refund From Razorpay Entity
|--------------------------------------------------------------------------
*/

const findRefundFromEntity = async (refundEntity) => {
  if (
    !refundEntity ||
    typeof refundEntity.id !== "string" ||
    typeof refundEntity.payment_id !== "string"
  ) {
    throw createError(
      "Webhook does not contain a valid Razorpay refund entity.",
      400
    );
  }

  const alternatives = [
    {
      razorpayRefundId: refundEntity.id,
    },
  ];

  if (
    typeof refundEntity.receipt === "string" &&
    refundEntity.receipt.trim()
  ) {
    alternatives.push({
      refundNumber: refundEntity.receipt.trim(),
    });
  }

  const notesRefundNumber =
    refundEntity.notes?.refundNumber;

  if (
    typeof notesRefundNumber === "string" &&
    notesRefundNumber.trim()
  ) {
    alternatives.push({
      refundNumber: notesRefundNumber.trim(),
    });
  }

  const refund = await Refund.findOne({
    $or: alternatives,
  });

  if (!refund) {
    throw createError(
      "No local refund matches this Razorpay refund. Retry delivery after reconciliation.",
      404
    );
  }

  if (
    !Number.isSafeInteger(Number(refundEntity.amount)) ||
    Number(refundEntity.amount) !==
      toPaise(refund.amount)
  ) {
    throw createError(
      "Webhook refund amount does not match the stored refund.",
      409
    );
  }

  if (
    refundEntity.currency &&
    refundEntity.currency !== refund.currency
  ) {
    throw createError(
      "Webhook refund currency does not match the stored refund.",
      409
    );
  }

  if (
    refund.razorpayRefundId &&
    refund.razorpayRefundId !== refundEntity.id
  ) {
    throw createError(
      "Razorpay refund ID does not match the stored refund.",
      409
    );
  }

  const payment = await Payment.findById(
    refund.payment
  ).lean();

  if (!payment) {
    throw createError(
      "The payment linked to this refund was not found.",
      404
    );
  }

  if (
    payment.paymentProvider !== "razorpay" ||
    payment.razorpayPaymentId !==
      refundEntity.payment_id
  ) {
    throw createError(
      "Refund webhook payment ID does not match the stored payment.",
      409
    );
  }

  return refund;
};

/*
|--------------------------------------------------------------------------
| Handle refund.processed and refund.failed
|--------------------------------------------------------------------------
|
| Razorpay refund entity amount is in paise.
| Local monetary fields are stored in rupees.
|--------------------------------------------------------------------------
*/

const handleRefundEvent = async ({
  event,
  refundEntity,
}) => {
  const expectedStatus =
    event.eventType === "refund.processed"
      ? "processed"
      : "failed";

  if (!refundEntity) {
    throw createError(
      "Refund webhook entity is missing.",
      400
    );
  }

  if (
    refundEntity.status &&
    refundEntity.status !== expectedStatus
  ) {
    throw createError(
      "Refund webhook event type and refund entity status do not match.",
      409
    );
  }

  const matchedRefund = await findRefundFromEntity(
    refundEntity
  );

  const session = await mongoose.startSession();
  let result = null;

  try {
    await session.withTransaction(async () => {
      const refund = await Refund.findById(
        matchedRefund._id
      ).session(session);

      if (!refund) {
        throw createError(
          "Refund record disappeared during webhook processing.",
          404
        );
      }

      const existingMetadata =
        refund.metadata &&
        typeof refund.metadata === "object" &&
        !Array.isArray(refund.metadata)
          ? refund.metadata
          : {};

      /*
       * Do not overwrite a final state. Conflicting events
       * require review rather than automatic downgrade.
       */
      if (refund.status === "processed") {
        if (event.eventType === "refund.failed") {
          refund.metadata = {
            ...existingMetadata,
            reconciliationRequired: true,
            reconciliationReason:
              "refund_failed_event_received_after_processed_status",
            lastRefundWebhookEventId: event.eventId,
          };

          await refund.save({ session });
        }

        result = {
          ignored: true,
          eventType: event.eventType,
          refundId: String(refund._id),
          status: refund.status,
          reconciliationRequired:
            event.eventType === "refund.failed",
        };

        return;
      }

      if (refund.status === "failed") {
        if (event.eventType === "refund.processed") {
          refund.metadata = {
            ...existingMetadata,
            reconciliationRequired: true,
            reconciliationReason:
              "refund_processed_event_received_after_failed_status",
            lastRefundWebhookEventId: event.eventId,
            observedGatewayRefundStatus: expectedStatus,
          };

          await refund.save({ session });
        }

        result = {
          ignored: true,
          eventType: event.eventType,
          refundId: String(refund._id),
          status: refund.status,
          reconciliationRequired:
            event.eventType === "refund.processed",
        };

        return;
      }

      if (refund.status !== "processing") {
        throw createError(
          `Refund with status "${refund.status}" cannot be finalized by a webhook.`,
          409
        );
      }

      const payment = await Payment.findById(
        refund.payment
      ).session(session);

      if (!payment) {
        throw createError(
          "Payment record not found during refund reconciliation.",
          404
        );
      }

      if (
        payment.razorpayPaymentId !==
          refundEntity.payment_id ||
        payment.paymentProvider !== "razorpay"
      ) {
        throw createError(
          "Refund webhook does not match the original Razorpay payment.",
          409
        );
      }

      if (
        refund.razorpayRefundId &&
        refund.razorpayRefundId !== refundEntity.id
      ) {
        throw createError(
          "Razorpay refund ID changed during reconciliation.",
          409
        );
      }

      const reservedAmount = Number(
        payment.refundReservedAmount ?? 0
      );

      if (
        reservedAmount + 0.001 <
        Number(refund.amount)
      ) {
        throw createError(
          "Refund reservation is inconsistent. Manual reconciliation is required.",
          409
        );
      }

      const now = new Date();

      payment.refundReservedAmount = roundMoney(
        reservedAmount - Number(refund.amount)
      );

      if (event.eventType === "refund.processed") {
        const newRefundAmount = roundMoney(
          Number(payment.refundAmount ?? 0) +
          Number(refund.amount)
        );

        if (
          newRefundAmount >
          Number(payment.amount) + 0.005
        ) {
          throw createError(
            "The processed refund would exceed the original payment amount.",
            409
          );
        }

        payment.refundAmount = newRefundAmount;

        payment.status =
          newRefundAmount >=
          Number(payment.amount) - 0.005
            ? "refunded"
            : "partially_refunded";

        payment.metadata = {
          ...(payment.metadata || {}),
          lastRefundWebhookEventId: event.eventId,
          lastRefundWebhookEventType: event.eventType,
        };

        await payment.save({ session });

        refund.status = "processed";
        refund.razorpayRefundId = refundEntity.id;
        refund.processedAt = now;
        refund.failureReason = null;

        refund.metadata = {
          ...existingMetadata,
          gatewayStatus: "processed",
          lastRefundWebhookEventId: event.eventId,
          lastRefundWebhookEventType: event.eventType,
          reconciliationRequired: false,
        };

        await refund.save({ session });

        await Order.updateOne(
          {
            _id: refund.order,
          },
          {
            $set: {
              paymentStatus: payment.status,
            },
          },
          {
            session,
            runValidators: true,
          }
        );

        const returnRequest = await ReturnRequest.findOne({
          refund: refund._id,
        }).session(session);

        if (refund.metadata?.returnRequestId) {
          if (
            !returnRequest ||
            returnRequest.status !== "refund_pending"
          ) {
            throw createError(
              "The return linked to this refund is no longer awaiting refund completion.",
              409
            );
          }

          returnRequest.status = "completed";
          returnRequest.completedAt = now;

          await returnRequest.save({ session });

          await completeReturnExchangeQuantity({
            orderId: returnRequest.order,
            orderItemId: returnRequest.orderItemId,
            quantity: returnRequest.quantity,
            session,
          });
        }
      } else {
        /*
         * Confirmed gateway failure:
         * release reserved balance without increasing
         * the amount actually refunded.
         */
        payment.metadata = {
          ...(payment.metadata || {}),
          lastRefundWebhookEventId: event.eventId,
          lastRefundWebhookEventType: event.eventType,
        };

        await payment.save({ session });

        refund.status = "failed";
        refund.razorpayRefundId = refundEntity.id;

        refund.failureReason = String(
          refundEntity.error_description ||
          refundEntity.error_reason ||
          refundEntity.error?.description ||
          "Razorpay reported that the refund failed."
        ).slice(0, 500);

        refund.metadata = {
          ...existingMetadata,
          gatewayStatus: "failed",
          lastRefundWebhookEventId: event.eventId,
          lastRefundWebhookEventType: event.eventType,
        };

        await refund.save({ session });
      }

      result = {
        ignored: false,
        eventType: event.eventType,
        refundId: String(refund._id),
        paymentId: String(payment._id),
        orderId: String(refund.order),
        status: refund.status,
      };
    });
  } finally {
    await session.endSession();
  }

  if (result?.status === expectedStatus) {
    const processed = expectedStatus === "processed";
    await emitCustomerNotification({
      recipientId: matchedRefund.user,
      type: "refund",
      title: processed ? "Refund processed" : "Refund failed",
      message: processed
        ? `Your refund ${matchedRefund.refundNumber} has been processed.`
        : `Your refund ${matchedRefund.refundNumber} could not be completed. Please contact store support.`,
      relatedOrder: matchedRefund.order,
      actionUrl: `/orders/${matchedRefund.order}`,
      idempotencyKey: `refund.${expectedStatus}:${matchedRefund._id}`,
    });
  }

  return result;
};

/*
|--------------------------------------------------------------------------
| Process Supported Event
|--------------------------------------------------------------------------
*/

const processPaymentEvent = async ({
  event,
  paymentEntity,
  refundEntity = null,
}) => {
  const supportedEvents = [
    "payment.authorized",
    "payment.captured",
    "payment.failed",
    "refund.processed",
    "refund.failed",
  ];

  if (!supportedEvents.includes(event.eventType)) {
    return {
      ignored: true,
      eventType: event.eventType,
    };
  }

  if (
    event.eventType === "refund.processed" ||
    event.eventType === "refund.failed"
  ) {
    return handleRefundEvent({
      event,
      refundEntity,
    });
  }

  const payment = await getMatchingPayment(
    paymentEntity
  );

  const order = await Order.findById(
    payment.order
  );

  if (!order) {
    throw createError(
      "Order for this payment was not found.",
      404
    );
  }

  if (
    String(order.user) !== String(payment.user) ||
    order.paymentMethod !== "razorpay"
  ) {
    throw createError(
      "Payment and order ownership do not match.",
      409
    );
  }

  const commonArgs = {
    payment,
    order,
    paymentEntity,
    eventId: event.eventId,
    eventType: event.eventType,
  };

  if (event.eventType === "payment.authorized") {
    await handlePaymentAuthorized(commonArgs);
  } else if (event.eventType === "payment.captured") {
    await handlePaymentCaptured(commonArgs);
    await emitCustomerNotification({
      recipientId: payment.user,
      type: "payment",
      title: "Payment successful",
      message:
        order.orderStatus === "cancelled"
          ? `Payment for order ${order.orderNumber} was received, but the order needs support review.`
          : `Payment for order ${order.orderNumber} was successful.`,
      relatedOrder: order._id,
      actionUrl: `/orders/${order._id}`,
      idempotencyKey: `payment.captured:${payment._id}`,
    });
  } else if (event.eventType === "payment.failed") {
    await handlePaymentFailed(commonArgs);
    await emitCustomerNotification({
      recipientId: payment.user,
      type: "payment",
      title: "Payment failed",
      message: `Payment for order ${order.orderNumber} failed. You can retry payment from your order.`,
      relatedOrder: order._id,
      actionUrl: `/orders/${order._id}`,
      idempotencyKey: `payment.failed:${payment._id}`,
    });
  }

  return {
    ignored: false,
    eventType: event.eventType,
    paymentId: String(payment._id),
    orderId: String(order._id),
  };
};

/*
|--------------------------------------------------------------------------
| Public Function: Verify And Process Webhook
|--------------------------------------------------------------------------
*/

export const processRazorpayWebhook = async ({
  rawBody,
  signature,
  eventId,
}) => {
  if (!Buffer.isBuffer(rawBody)) {
    throw createError(
      "Webhook raw request body is required.",
      400
    );
  }

  if (
    typeof eventId !== "string" ||
    !eventId.trim() ||
    eventId.trim().length > 200
  ) {
    throw createError(
      "A valid Razorpay webhook event ID is required.",
      400
    );
  }

  const normalizedEventId = eventId.trim();
  const secret = getWebhookSecret();

  const signatureIsValid = verifyWebhookSignature(
    rawBody,
    signature,
    secret
  );

  if (!signatureIsValid) {
    throw createError(
      "Invalid Razorpay webhook signature.",
      400
    );
  }

  let payload;

  try {
    payload = JSON.parse(
      rawBody.toString("utf8")
    );
  } catch {
    throw createError(
      "Webhook body contains invalid JSON.",
      400
    );
  }

  if (
    !payload ||
    typeof payload.event !== "string" ||
    !payload.event.trim()
  ) {
    throw createError(
      "Webhook event type is missing.",
      400
    );
  }

  const eventType = payload.event.trim();
  const paymentEntity = getPaymentEntity(payload);
  const refundEntity = getRefundEntity(payload);

  const claim = await claimWebhookEvent({
    eventId: normalizedEventId,
    eventType,
    paymentEntity,
    refundEntity,
  });

  if (claim.duplicate) {
    return {
      received: true,
      duplicate: true,
      eventId: normalizedEventId,
      message: "Webhook event was already processed.",
    };
  }

  try {
    const result = await processPaymentEvent({
      event: {
        eventId: normalizedEventId,
        eventType,
      },
      paymentEntity,
      refundEntity,
    });

    claim.event.status = "processed";
    claim.event.processedAt = new Date();
    claim.event.lastError = null;

    await claim.event.save();

    return {
      received: true,
      duplicate: false,
      eventId: normalizedEventId,
      ...result,
    };
  } catch (error) {
    claim.event.status = "failed";
    claim.event.lastError = String(
      error.message || "Webhook processing failed."
    ).slice(0, 1000);

    await claim.event.save().catch(() => {});

    throw error;
  }
};