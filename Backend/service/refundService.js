import { randomBytes } from "node:crypto";
import mongoose from "mongoose";
import Razorpay from "razorpay";

import Refund from "../models/Refund.js";
import Payment from "../models/Payment.js";
import Order from "../models/Order.js";
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

const roundMoney = (value) => {
  return Math.round(
    (Number(value) + Number.EPSILON) * 100
  ) / 100;
};

const rupeesToPaise = (amount) => {
  const paise = Math.round(
    Number(amount) * 100
  );

  if (
    !Number.isFinite(Number(amount)) ||
    !Number.isSafeInteger(paise) ||
    paise < 1
  ) {
    throw createError(
      "Refund amount must be a valid positive amount.",
      400
    );
  }

  return paise;
};

const generateRefundNumber = () => {
  const date = new Date()
    .toISOString()
    .slice(0, 10)
    .replace(/-/g, "");

  const uniquePart = randomBytes(4)
    .toString("hex")
    .toUpperCase();

  return `NIA-REF-${date}-${uniquePart}`;
};

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
| Populate Configuration
|--------------------------------------------------------------------------
*/

const populateRefundDetails = [
  {
    path: "order",
    select:
      "orderNumber orderStatus paymentStatus paymentMethod totalAmount currency",
  },
  {
    path: "payment",
    select:
      "paymentMethod paymentProvider amount currency status razorpayPaymentId refundAmount refundReservedAmount",
  },
  {
    path: "user",
    select: "name email phone",
  },
];

const notifyRefundCustomer = async (refund, status) => {
  if (!refund?.user || !refund?.order) {
    console.error(
      "Refund notification is missing a customer or order:",
      String(refund?._id)
    );
    return;
  }

  const statusMessages = {
    processed: {
      title: "Refund processed",
      message: `Your refund ${refund.refundNumber} has been processed.`,
    },
    rejected: {
      title: "Refund request declined",
      message: `Your refund ${refund.refundNumber} was declined. ${refund.rejectionReason || "Please contact store support for assistance."}`,
    },
    failed: {
      title: "Refund failed",
      message: `Your refund ${refund.refundNumber} could not be completed. Please contact store support.`,
    },
  };
  const notification = statusMessages[status];
  if (!notification) {
    throw new Error(`Unsupported refund notification status: ${status}`);
  }
  await emitCustomerNotification({
    recipientId: refund.user,
    type: "refund",
    title: notification.title,
    message: notification.message,
    relatedOrder: refund.order,
    actionUrl: `/orders/${refund.order}`,
    idempotencyKey: `refund.${status}:${refund._id}`,
  });
};

/*
|--------------------------------------------------------------------------
| 1. Create Refund Request For An Eligible Return
|--------------------------------------------------------------------------
|
| The return must already be in refund_pending status.
|
| The amount is calculated from the original order item.
| Client-supplied refund amounts are not accepted.
|--------------------------------------------------------------------------
*/

export const createRefundForReturnRequest = async (
  adminId,
  returnRequestId
) => {
  const validatedAdminId = validateObjectId(
    adminId,
    "admin ID"
  );

  const validatedReturnRequestId = validateObjectId(
    returnRequestId,
    "return request ID"
  );

  const returnRequest = await ReturnRequest.findById(
    validatedReturnRequestId
  );

  if (!returnRequest) {
    throw createError(
      "Return request not found.",
      404
    );
  }

  /*
   * Repeated requests for the same return must not create
   * another refund record.
   */
  let failedRefundId = null;

  if (returnRequest.refund) {
    const existingRefund = await Refund.findById(
      returnRequest.refund
    );

    if (existingRefund) {
      if (existingRefund.status !== "failed") {
        return existingRefund.toObject();
      }

      failedRefundId = existingRefund._id;
    } else {
      throw createError(
        "The return request references a missing refund record. Manual review is required.",
        409
      );
    }
  }

  if (returnRequest.status !== "refund_pending") {
    throw createError(
      "The return must complete inspection and enter refund_pending before a refund can be created.",
      409
    );
  }

  const order = await Order.findById(
    returnRequest.order
  ).lean();

  if (!order) {
    throw createError(
      "The related order could not be found.",
      404
    );
  }

  if (
    !order.user ||
    String(order.user) !== String(returnRequest.user)
  ) {
    throw createError(
      "The return request and order ownership do not match.",
      409
    );
  }

  const orderItem = (order.items || []).find(
    (item) =>
      String(item._id) ===
      String(returnRequest.orderItemId)
  );

  if (!orderItem) {
    throw createError(
      "The returned item could not be found in the original order.",
      409
    );
  }

  if (
    !Number.isInteger(returnRequest.quantity) ||
    returnRequest.quantity < 1 ||
    returnRequest.quantity > orderItem.quantity
  ) {
    throw createError(
      "The return quantity is invalid for this order item.",
      409
    );
  }

  const lineTotal = Number(
    orderItem.lineTotal ??
    Number(orderItem.unitPrice) * orderItem.quantity
  );

  const unitRefundAmount =
    lineTotal / orderItem.quantity;

  const refundAmount = roundMoney(
    unitRefundAmount * returnRequest.quantity
  );

  if (
    !Number.isFinite(refundAmount) ||
    refundAmount <= 0
  ) {
    throw createError(
      "The calculated refund amount is invalid.",
      409
    );
  }

  let payment = null;
  let refundMethod = "original_payment";
  let alreadyRefunded = 0;
  let alreadyReserved = 0;

  if (order.paymentMethod === "cod") {
    if (!["paid", "partially_refunded"].includes(order.paymentStatus)) {
      throw createError(
        "A COD return can be refunded only after cash collection is confirmed as paid.",
        409
      );
    }

    refundMethod = "manual";
    alreadyRefunded = Number(order.manualRefundAmount ?? 0);
    alreadyReserved = Number(
      order.manualRefundReservedAmount ?? 0
    );
  } else if (order.paymentMethod === "razorpay") {
    const payments = await Payment.find({
      order: order._id,
      paymentProvider: "razorpay",
      status: {
        $in: ["captured", "partially_refunded"],
      },
      razorpayPaymentId: {
        $type: "string",
      },
    }).lean();

    if (payments.length !== 1) {
      throw createError(
        payments.length === 0
          ? "A captured Razorpay payment was not found for this order."
          : "Multiple captured payments were found for this order. Manual reconciliation is required.",
        409
      );
    }

    payment = payments[0];
    alreadyRefunded = Number(payment.refundAmount ?? 0);
    alreadyReserved = Number(
      payment.refundReservedAmount ?? 0
    );
  } else {
    throw createError(
      "This order payment method does not support refunds.",
      409
    );
  }

  if (payment) {
    const availableAmount = roundMoney(
      Number(payment.amount) -
      alreadyRefunded -
      alreadyReserved
    );

    if (refundAmount > availableAmount + 0.001) {
      throw createError(
        "The calculated refund exceeds the available refundable balance.",
        409
      );
    }
  }

  let refund;
  const session = await mongoose.startSession();

  try {
    await session.withTransaction(async () => {
      if (refundMethod === "manual") {
        const reservedOrder = await Order.findOneAndUpdate(
          {
            _id: order._id,
            paymentStatus: {
              $in: ["paid", "partially_refunded"],
            },
            $expr: {
              $lte: [
                {
                  $add: [
                    {
                      $ifNull: [
                        "$manualRefundAmount",
                        0,
                      ],
                    },
                    {
                      $ifNull: [
                        "$manualRefundReservedAmount",
                        0,
                      ],
                    },
                    refundAmount,
                  ],
                },
                { $add: ["$totalAmount", 0.005] },
              ],
            },
          },
          {
            $inc: {
              manualRefundReservedAmount: refundAmount,
            },
          },
          {
            new: false,
            session,
          }
        );

        if (!reservedOrder) {
          throw createError(
            "The requested COD refund exceeds the remaining paid order balance.",
            409
          );
        }

        alreadyRefunded = Number(
          reservedOrder.manualRefundAmount ?? 0
        );
        alreadyReserved = Number(
          reservedOrder.manualRefundReservedAmount ?? 0
        );
      }

      const isFullRefund =
        alreadyRefunded === 0 &&
        alreadyReserved === 0 &&
        Math.abs(
          refundAmount -
          Number(payment?.amount ?? order.totalAmount)
        ) < 0.005;

      [refund] = await Refund.create(
        [{
          refundNumber: generateRefundNumber(),

          order: order._id,
          payment: payment?._id ?? null,
          user: order.user,

          refundType: isFullRefund ? "full" : "partial",

          reason: "product_return",

          reasonDetails:
            `Return ${returnRequest.returnNumber}: ` +
            String(returnRequest.reasonDetails || "")
              .slice(0, 850),

          amount: refundAmount,
          currency: "INR",

          status: "requested",
          refundMethod,

          metadata: {
            returnRequestId: String(returnRequest._id),
            returnNumber: returnRequest.returnNumber,
            itemId: String(orderItem._id),
            requestedByAdminId: validatedAdminId,
            ...(refundMethod === "manual"
              ? { manualPayoutRequired: true }
              : {}),
          },
        }],
        { session }
      );

      const linkFilter = failedRefundId
        ? {
            _id: returnRequest._id,
            status: "refund_pending",
            refund: failedRefundId,
          }
        : {
            _id: returnRequest._id,
            status: "refund_pending",
            $or: [
              { refund: null },
              { refund: { $exists: false } },
            ],
          };

      const linkedReturn =
        await ReturnRequest.findOneAndUpdate(
          linkFilter,
          {
            $set: {
              refund: refund._id,
            },
          },
          {
            returnDocument: "after",
            session,
          }
        );

      if (!linkedReturn) {
        throw createError(
          "The return request changed while the refund was being created. Refresh and retry.",
          409
        );
      }
    });
  } catch (error) {
    if (error.code === 11000) {
      throw createError(
        "A duplicate refund request was detected.",
        409
      );
    }

    if (failedRefundId && error.statusCode === 409) {
      const latestReturn = await ReturnRequest.findById(
        returnRequest._id
      ).lean();

      if (
        latestReturn?.refund &&
        String(latestReturn.refund) !== String(failedRefundId)
      ) {
        const existingRefund = await Refund.findById(
          latestReturn.refund
        );

        if (
          existingRefund &&
          existingRefund.status !== "failed"
        ) {
          return existingRefund.toObject();
        }
      }
    }

    throw error;
  } finally {
    await session.endSession();
  }

  return refund.toObject();
}

/*
|--------------------------------------------------------------------------
| 2. Approve A Refund Request
|--------------------------------------------------------------------------
|
| Only requested refunds may be approved.
|--------------------------------------------------------------------------
*/

export const approveRefund = async (
  adminId,
  refundId
) => {
  const validatedAdminId = validateObjectId(
    adminId,
    "admin ID"
  );

  const validatedRefundId = validateObjectId(
    refundId,
    "refund ID"
  );

  const refund = await Refund.findById(
    validatedRefundId
  );

  if (!refund) {
    throw createError(
      "Refund not found.",
      404
    );
  }

  if (refund.status !== "requested") {
    throw createError(
      `A refund with status "${refund.status}" cannot be approved again.`,
      409
    );
  }

  const returnRequestId =
    refund.metadata?.returnRequestId;

  if (!returnRequestId) {
    throw createError(
      "The refund is not linked to a return request.",
      409
    );
  }

  const returnRequest = await ReturnRequest.findOne({
    _id: returnRequestId,
    refund: refund._id,
    status: "refund_pending",
  }).lean();

  if (!returnRequest) {
    throw createError(
      "The linked return is no longer eligible for refund approval.",
      409
    );
  }

  const updatedRefund =
    await Refund.findOneAndUpdate(
      {
        _id: refund._id,
        status: "requested",
      },
      {
        $set: {
          status: "approved",
          approvedAt: new Date(),
          metadata: {
            ...(refund.metadata || {}),
            approvedByAdminId: validatedAdminId,
          },
        },
      },
      {
        returnDocument: "after",
        runValidators: true,
      }
    );

  if (!updatedRefund) {
    throw createError(
      "The refund changed while being approved. Refresh and retry.",
      409
    );
  }

  return updatedRefund.toObject();
};

export const rejectRefund = async (adminId, refundId, data) => {
  const validatedAdminId = validateObjectId(adminId, "admin ID");
  const validatedRefundId = validateObjectId(refundId, "refund ID");

  if (!data || typeof data !== "object" || Array.isArray(data)) {
    throw createError("Refund rejection data must be a valid object.", 400);
  }

  const unknownFields = Object.keys(data).filter(
    (field) => field !== "rejectionReason"
  );
  if (unknownFields.length) {
    throw createError(
      `Unsupported field(s): ${unknownFields.join(", ")}.`,
      400
    );
  }

  if (
    typeof data.rejectionReason !== "string" ||
    !data.rejectionReason.trim() ||
    data.rejectionReason.trim().length > 500
  ) {
    throw createError(
      "A rejection reason between 1 and 500 characters is required.",
      400
    );
  }

  const currentRefund = await Refund.findById(validatedRefundId);
  if (!currentRefund) throw createError("Refund not found.", 404);
  if (currentRefund.status !== "requested") {
    throw createError(
      `A refund with status "${currentRefund.status}" cannot be rejected.`,
      409
    );
  }

  const returnRequestId = currentRefund.metadata?.returnRequestId;
  if (!returnRequestId) {
    throw createError("The refund is not linked to a return request.", 409);
  }

  const returnRequest = await ReturnRequest.findOne({
    _id: returnRequestId,
    refund: currentRefund._id,
    status: "refund_pending",
  }).lean();
  if (!returnRequest) {
    throw createError(
      "The linked return is no longer eligible for refund review.",
      409
    );
  }

  const updatedRefund = await Refund.findOneAndUpdate(
    { _id: currentRefund._id, status: "requested" },
    {
      $set: {
        status: "rejected",
        rejectionReason: data.rejectionReason.trim(),
        rejectedAt: new Date(),
        rejectedBy: validatedAdminId,
      },
    },
    { returnDocument: "after", runValidators: true }
  );

  if (!updatedRefund) {
    throw createError(
      "The refund changed while being rejected. Refresh and retry.",
      409
    );
  }

  const result = updatedRefund.toObject();
  await notifyRefundCustomer(result, "rejected");
  return result;
};

/*
|--------------------------------------------------------------------------
| 3. Release A Refund Reservation After A Confirmed Failure
|--------------------------------------------------------------------------
*/

const markRefundFailed = async (
  refundId,
  failureReason,
  razorpayRefundId = null
) => {
  const session = await mongoose.startSession();

  let result = null;

  try {
    await session.withTransaction(async () => {
      const refund = await Refund.findOne({
        _id: refundId,
        status: "processing",
      }).session(session);

      if (!refund) {
        result = await Refund.findById(refundId)
          .session(session);

        return;
      }

      const payment = await Payment.findById(
        refund.payment
      ).session(session);

      if (!payment) {
        throw createError(
          "Payment record not found during refund reconciliation.",
          409
        );
      }

      const reservedAmount = Number(
        payment.refundReservedAmount ?? 0
      );

      if (reservedAmount + 0.001 < refund.amount) {
        throw createError(
          "Refund reservation is inconsistent. Manual reconciliation is required.",
          409
        );
      }

      payment.refundReservedAmount = roundMoney(
        reservedAmount - refund.amount
      );

      await payment.save({ session });

      refund.status = "failed";
      refund.failureReason = String(
        failureReason || "The payment provider rejected the refund."
      ).slice(0, 500);

      if (razorpayRefundId) {
        refund.razorpayRefundId = razorpayRefundId;
      }

      await refund.save({ session });

      result = refund;
    });

    const refundResult = result?.toObject?.() ?? result;
    if (refundResult?.status === "failed") {
      await notifyRefundCustomer(refundResult, "failed");
    }
    return refundResult;
  } finally {
    await session.endSession();
  }
};

/*
|--------------------------------------------------------------------------
| 4. Finalize A Successful Refund
|--------------------------------------------------------------------------
|
| This update is transactional: the payment total, refund
| status, order payment status, and return status are saved
| together to avoid partial database updates.
|--------------------------------------------------------------------------
*/

const finalizeSuccessfulRefund = async (refundId) => {
  const session = await mongoose.startSession();

  let result = null;

  try {
    await session.withTransaction(async () => {
      const refund = await Refund.findById(
        refundId
      ).session(session);

      if (!refund) {
        throw createError(
          "Refund not found during reconciliation.",
          404
        );
      }

      if (refund.status === "processed") {
        result = refund;
        return;
      }

      if (
        refund.status !== "processing" ||
        !refund.razorpayRefundId
      ) {
        throw createError(
          "The refund is not ready to be finalized.",
          409
        );
      }

      const payment = await Payment.findById(
        refund.payment
      ).session(session);

      if (!payment) {
        throw createError(
          "Payment record not found during refund reconciliation.",
          409
        );
      }

      const reservedAmount = Number(
        payment.refundReservedAmount ?? 0
      );

      if (reservedAmount + 0.001 < refund.amount) {
        throw createError(
          "Refund reservation is inconsistent. Manual reconciliation is required.",
          409
        );
      }

      payment.refundAmount = roundMoney(
        Number(payment.refundAmount ?? 0) +
        refund.amount
      );

      payment.refundReservedAmount = roundMoney(
        reservedAmount - refund.amount
      );

      payment.status =
        payment.refundAmount >=
        Number(payment.amount) - 0.005
          ? "refunded"
          : "partially_refunded";

      await payment.save({ session });

      const now = new Date();

      refund.status = "processed";
      refund.processedAt = now;

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

      const returnRequestId =
        refund.metadata?.returnRequestId;

      if (returnRequestId) {
        const returnResult = await ReturnRequest.updateOne(
          {
            _id: returnRequestId,
            refund: refund._id,
            status: "refund_pending",
          },
          {
            $set: {
              status: "completed",
              completedAt: now,
            },
          },
          {
            session,
            runValidators: true,
          }
        );

        if (returnResult.modifiedCount !== 1) {
          throw createError(
            "The linked return is no longer awaiting this refund.",
            409
          );
        }

        const returnRequest = await ReturnRequest.findOne({
          _id: returnRequestId,
          refund: refund._id,
        })
          .select("order orderItemId quantity")
          .session(session)
          .lean();

        if (!returnRequest) {
          throw createError(
            "The return linked to this refund could not be found during finalization.",
            409
          );
        }

        await completeReturnExchangeQuantity({
          orderId: returnRequest.order,
          orderItemId: returnRequest.orderItemId,
          quantity: returnRequest.quantity,
          session,
        });
      }

      result = refund;
    });

    const refundResult = result?.toObject?.() ?? result;
    if (refundResult?.status === "processed") {
      await notifyRefundCustomer(refundResult, "processed");
    }
    return refundResult;
  } finally {
    await session.endSession();
  }
};

const recordManualRefundPayout = async (
  adminId,
  refund,
  payoutDetails
) => {
  if (
    !payoutDetails ||
    typeof payoutDetails !== "object" ||
    Array.isArray(payoutDetails)
  ) {
    throw createError(
      "Manual payout details must be an object.",
      400
    );
  }

  const allowedFields = ["method", "reference"];
  const unknownFields = Object.keys(payoutDetails).filter(
    (field) => !allowedFields.includes(field)
  );

  if (unknownFields.length > 0) {
    throw createError(
      `Unsupported payout field(s): ${unknownFields.join(", ")}.`,
      400
    );
  }

  const allowedMethods = [
    "bank_transfer",
    "upi",
    "cash",
    "other",
  ];
  const method = payoutDetails.method;
  const reference =
    typeof payoutDetails.reference === "string"
      ? payoutDetails.reference.trim()
      : "";

  if (!allowedMethods.includes(method)) {
    throw createError(
      `Payout method must be one of: ${allowedMethods.join(", ")}.`,
      400
    );
  }

  if (!reference || reference.length > 150) {
    throw createError(
      "A payout reference between 1 and 150 characters is required.",
      400
    );
  }

  const session = await mongoose.startSession();
  let processedRefund;

  try {
    await session.withTransaction(async () => {
      processedRefund = await Refund.findOneAndUpdate(
        {
          _id: refund._id,
          status: "processing",
          refundMethod: "manual",
        },
        {
          $set: {
            status: "processed",
            manualPayoutMethod: method,
            manualPayoutReference: reference,
            processedAt: new Date(),
            processedBy: adminId,
          },
        },
        {
          returnDocument: "after",
          runValidators: true,
          session,
        }
      );

      if (!processedRefund) {
        throw createError(
          "The manual refund is not awaiting payout confirmation.",
          409
        );
      }

      const returnRequestId =
        refund.metadata?.returnRequestId;

      const returnRequest = await ReturnRequest.findOneAndUpdate(
        {
          _id: returnRequestId,
          refund: refund._id,
          status: "refund_pending",
        },
        {
          $set: {
            status: "completed",
            completedAt: processedRefund.processedAt,
          },
        },
        {
          returnDocument: "after",
          runValidators: true,
          session,
        }
      ).lean();

      if (!returnRequest) {
        throw createError(
          "The linked return is no longer awaiting this refund.",
          409
        );
      }

      await completeReturnExchangeQuantity({
        orderId: returnRequest.order,
        orderItemId: returnRequest.orderItemId,
        quantity: returnRequest.quantity,
        session,
      });

      const order = await Order.findOneAndUpdate(
        {
          _id: refund.order,
          paymentMethod: "cod",
          paymentStatus: {
            $in: ["paid", "partially_refunded"],
          },
          $expr: {
            $gte: [
              {
                $ifNull: [
                  "$manualRefundReservedAmount",
                  0,
                ],
              },
              refund.amount,
            ],
          },
        },
        {
          $inc: {
            manualRefundAmount: refund.amount,
            manualRefundReservedAmount: -refund.amount,
          },
        },
        {
          returnDocument: "after",
          session,
        }
      )
        .select("totalAmount manualRefundAmount")
        .lean();

      if (!order) {
        throw createError(
          "The order's reserved manual refund amount is inconsistent. Manual reconciliation is required.",
          409
        );
      }

      const orderPaymentStatus =
        Number(order.manualRefundAmount) >=
        Number(order.totalAmount) - 0.005
          ? "refunded"
          : "partially_refunded";

      const orderStatusUpdate = await Order.updateOne(
        {
          _id: refund.order,
          paymentMethod: "cod",
          paymentStatus: {
            $in: ["paid", "partially_refunded"],
          },
        },
        {
          $set: {
            paymentStatus: orderPaymentStatus,
          },
        },
        {
          session,
          runValidators: true,
        }
      );

      if (orderStatusUpdate.modifiedCount !== 1) {
        throw createError(
          "The order payment status changed while recording the manual refund.",
          409
        );
      }
    });

    const result = processedRefund.toObject();
    await notifyRefundCustomer(result, "processed");
    return result;
  } finally {
    await session.endSession();
  }
};

const markManualRefundFailed = async (
  adminId,
  refund,
  failureReason
) => {
  if (
    typeof failureReason !== "string" ||
    !failureReason.trim() ||
    failureReason.trim().length > 500
  ) {
    throw createError(
      "A manual payout failure reason between 1 and 500 characters is required.",
      400
    );
  }

  const session = await mongoose.startSession();
  let updatedRefund;

  try {
    await session.withTransaction(async () => {
      updatedRefund = await Refund.findOneAndUpdate(
        {
          _id: refund._id,
          status: "processing",
          refundMethod: "manual",
        },
        {
          $set: {
            status: "failed",
            failureReason: failureReason.trim(),
            processedBy: adminId,
          },
        },
        {
          returnDocument: "after",
          runValidators: true,
          session,
        }
      );

      if (!updatedRefund) {
        throw createError(
          "The manual refund is no longer awaiting payout confirmation.",
          409
        );
      }

      const releasedOrder = await Order.updateOne(
        {
          _id: refund.order,
          paymentMethod: "cod",
          paymentStatus: {
            $in: ["paid", "partially_refunded"],
          },
          $expr: {
            $gte: [
              {
                $ifNull: [
                  "$manualRefundReservedAmount",
                  0,
                ],
              },
              refund.amount,
            ],
          },
        },
        {
          $inc: {
            manualRefundReservedAmount: -refund.amount,
          },
        },
        { session }
      );

      if (releasedOrder.modifiedCount !== 1) {
        throw createError(
          "The order's reserved manual refund amount is inconsistent. Manual reconciliation is required.",
          409
        );
      }
    });

    const result = updatedRefund.toObject();
    await notifyRefundCustomer(result, "failed");
    return result;
  } finally {
    await session.endSession();
  }
};

/*
|--------------------------------------------------------------------------
| 5. Process An Approved Refund
|--------------------------------------------------------------------------
|
| Only approved refunds may reach Razorpay.
|
| The amount is reserved atomically before calling the
| provider. If the provider outcome is uncertain, the
| reservation is retained until reconciliation.
|--------------------------------------------------------------------------
*/

export const processApprovedRefund = async (
  adminId,
  refundId,
  payoutDetails
) => {
  const validatedAdminId = validateObjectId(
    adminId,
    "admin ID"
  );

  const validatedRefundId = validateObjectId(
    refundId,
    "refund ID"
  );

  const refund = await Refund.findById(
    validatedRefundId
  );

  if (!refund) {
    throw createError(
      "Refund not found.",
      404
    );
  }

  if (refund.refundMethod === "manual") {
    if (refund.status === "approved") {
      const claimedRefund = await Refund.findOneAndUpdate(
        {
          _id: refund._id,
          status: "approved",
          refundMethod: "manual",
        },
        {
          $set: {
            status: "processing",
            processedBy: validatedAdminId,
            metadata: {
              ...(refund.metadata || {}),
              manualPayoutStartedAt: new Date().toISOString(),
            },
          },
        },
        {
          returnDocument: "after",
          runValidators: true,
        }
      );

      if (!claimedRefund) {
        throw createError(
          "The manual refund was claimed by another admin. Refresh and check its status.",
          409
        );
      }

      return claimedRefund.toObject();
    }

    if (refund.status === "processing") {
      if (
        payoutDetails &&
        typeof payoutDetails === "object" &&
        !Array.isArray(payoutDetails) &&
        Object.hasOwn(payoutDetails, "failureReason")
      ) {
        const allowedFailureFields = ["failureReason"];
        const unknownFields = Object.keys(payoutDetails).filter(
          (field) => !allowedFailureFields.includes(field)
        );

        if (unknownFields.length > 0) {
          throw createError(
            `Unsupported payout field(s): ${unknownFields.join(", ")}.`,
            400
          );
        }

        return markManualRefundFailed(
          validatedAdminId,
          refund,
          payoutDetails.failureReason
        );
      }

      return recordManualRefundPayout(
        validatedAdminId,
        refund,
        payoutDetails
      );
    }
  }

  if (refund.status === "processed") {
    return refund.toObject();
  }

  if (refund.status === "processing") {
    throw createError(
      "This refund is already processing or awaiting gateway reconciliation. Do not submit it again.",
      409
    );
  }

  if (refund.status !== "approved") {
    throw createError(
      "Only an approved refund can be processed.",
      409
    );
  }

  const payment = await Payment.findById(
    refund.payment
  ).lean();

  if (!payment) {
    throw createError(
      "Payment not found.",
      404
    );
  }

  if (
    payment.paymentProvider !== "razorpay" ||
    !payment.razorpayPaymentId ||
    !["captured", "partially_refunded"].includes(
      payment.status
    )
  ) {
    throw createError(
      "The original Razorpay payment is not eligible for refund.",
      409
    );
  }

  const razorpay = getRazorpayClient();
  const refundAmountPaise = rupeesToPaise(refund.amount);

  /*
   * Claim this refund so concurrent admin requests cannot
   * submit the same refund to the gateway simultaneously.
   */
  const claimedRefund =
    await Refund.findOneAndUpdate(
      {
        _id: refund._id,
        status: "approved",
      },
      {
        $set: {
          status: "processing",
          processedBy: validatedAdminId,
          metadata: {
            ...(refund.metadata || {}),
            processingStartedAt: new Date().toISOString(),
          },
        },
      },
      {
        returnDocument: "after",
        runValidators: true,
      }
    );

  if (!claimedRefund) {
    throw createError(
      "The refund was claimed by another request. Refresh and check its status.",
      409
    );
  }

  /*
   * Reserve the amount atomically. Existing refunds and
   * concurrent reservations are included in the balance.
   */
  const reservationResult = await Payment.updateOne(
    {
      _id: payment._id,
      status: {
        $in: ["captured", "partially_refunded"],
      },
      $expr: {
        $lte: [
          {
            $add: [
              { $ifNull: ["$refundAmount", 0] },
              { $ifNull: ["$refundReservedAmount", 0] },
              refund.amount,
            ],
          },
          "$amount",
        ],
      },
    },
    {
      $inc: {
        refundReservedAmount: refund.amount,
      },
    },
    {
      runValidators: true,
    }
  );

  if (reservationResult.modifiedCount !== 1) {
    await Refund.updateOne(
      {
        _id: claimedRefund._id,
        status: "processing",
      },
      {
        $set: {
          status: "approved",
        },
        $unset: {
          processedBy: 1,
        },
      }
    );

    throw createError(
      "The refund exceeds the available refundable balance.",
      409
    );
  }

  let gatewayRefund;

  try {
    gatewayRefund = await razorpay.payments.refund(
      payment.razorpayPaymentId,
      {
        amount: refundAmountPaise,
        receipt: refund.refundNumber,
        speed: "normal",
        notes: {
          refundNumber: refund.refundNumber,
          orderId: String(refund.order),
          returnRequestId: String(
            refund.metadata?.returnRequestId || ""
          ),
        },
      }
    );
  } catch (error) {
    /*
     * A clear 4xx response means the provider rejected the
     * request. Release the reservation.
     *
     * A timeout/network/5xx error may have an uncertain
     * outcome. Keep status processing and retain the
     * reservation: retrying blindly could refund twice.
     */
    if (
      Number.isInteger(error.statusCode) &&
      error.statusCode >= 400 &&
      error.statusCode < 500
    ) {
      await markRefundFailed(
        refund._id,
        error.error?.description ||
          "Razorpay rejected the refund request."
      );

      throw createError(
        "Razorpay rejected the refund request. The refund is marked failed; review the payment before attempting a new refund.",
        502
      );
    }

    await Refund.updateOne(
      {
        _id: refund._id,
        status: "processing",
      },
      {
        $set: {
          "metadata.gatewayOutcome": "unknown",
          "metadata.lastGatewayError":
            String(error.message || "Unknown gateway error")
              .slice(0, 300),
        },
      }
    );

    throw createError(
      "The refund result is uncertain. Do not retry automatically; reconcile it with Razorpay before taking further action.",
      502
    );
  }

  if (!gatewayRefund?.id) {
    await Refund.updateOne(
      {
        _id: refund._id,
        status: "processing",
      },
      {
        $set: {
          "metadata.gatewayOutcome": "unknown",
          "metadata.lastGatewayError":
            "Razorpay returned no refund ID.",
        },
      }
    );

    throw createError(
      "Razorpay returned no refund ID. The refund requires reconciliation; do not resubmit it.",
      502
    );
  }

  /*
   * Save the gateway refund ID before finalizing. This
   * gives later webhook/reconciliation handlers a durable
   * reference even if the final database transaction fails.
   */
  const refundWithGatewayId =
    await Refund.findOneAndUpdate(
      {
        _id: refund._id,
        status: "processing",
      },
      {
        $set: {
          razorpayRefundId: gatewayRefund.id,
          metadata: {
            ...(claimedRefund.metadata || {}),
            gatewayStatus: gatewayRefund.status || "unknown",
            gatewayCreatedAt: gatewayRefund.created_at ?? null,
          },
        },
      },
      {
        returnDocument: "after",
        runValidators: true,
      }
    );

  if (!refundWithGatewayId) {
    throw createError(
      "The gateway refund was created but its local record needs reconciliation.",
      409
    );
  }

  if (gatewayRefund.status === "processed") {
    return finalizeSuccessfulRefund(refund._id);
  }

  if (gatewayRefund.status === "failed") {
    return markRefundFailed(
      refund._id,
      "Razorpay reported that the refund failed.",
      gatewayRefund.id
    );
  }

  /*
   * Pending/unknown provider status:
   * keep the refund processing and reservation intact.
   * A verified refund webhook/reconciliation must finalize it.
   */
  return refundWithGatewayId.toObject();
};

/*
|--------------------------------------------------------------------------
| 6. Get Refund Details — Admin
|--------------------------------------------------------------------------
*/

export const getAdminRefundById = async (refundId) => {
  const validatedRefundId = validateObjectId(
    refundId,
    "refund ID"
  );

  const refund = await Refund.findById(
    validatedRefundId
  )
    .populate(populateRefundDetails)
    .lean();

  if (!refund) {
    throw createError(
      "Refund not found.",
      404
    );
  }

  return refund;
};

export const listAdminRefunds = async (options = {}) => {
  const page = Number(options.page ?? 1);
  const limit = Number(options.limit ?? 20);

  if (!Number.isInteger(page) || page < 1) {
    throw createError("Page must be a positive integer.", 400);
  }

  if (!Number.isInteger(limit) || limit < 1 || limit > 100) {
    throw createError(
      "Limit must be an integer between 1 and 100.",
      400
    );
  }

  const filter = {};
  const allowedStatuses = [
    "requested",
    "approved",
    "processing",
    "processed",
    "rejected",
    "failed",
    "cancelled",
  ];

  if (options.status) {
    if (!allowedStatuses.includes(options.status)) {
      throw createError("Invalid refund status filter.", 400);
    }

    filter.status = options.status;
  }

  if (options.refundMethod) {
    if (!["original_payment", "manual"].includes(options.refundMethod)) {
      throw createError("Invalid refund method filter.", 400);
    }

    filter.refundMethod = options.refundMethod;
  }

  if (options.orderId) {
    filter.order = validateObjectId(options.orderId, "order ID");
  }

  const skip = (page - 1) * limit;
  const [refunds, total] = await Promise.all([
    Refund.find(filter)
      .populate(populateRefundDetails)
      .sort({ createdAt: -1, _id: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),
    Refund.countDocuments(filter),
  ]);

  return {
    refunds,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  };
};