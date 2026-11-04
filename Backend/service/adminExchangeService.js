import mongoose from "mongoose";
import ExchangeRequest from "../models/ExchangeRequest.js";
import Inventory from "../models/Inventory.js";
import {
  completeReturnExchangeQuantity,
  releaseReturnExchangeQuantity,
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

const isValidObjectId = (value) =>
  typeof value === "string" &&
  /^[a-f\d]{24}$/i.test(value);

const validateObjectId = (value, fieldName) => {
  if (!isValidObjectId(String(value ?? ""))) {
    throw createError(`Invalid ${fieldName}.`, 400);
  }

  return String(value);
};

const exchangeStatuses = [
  "requested",
  "under_review",
  "approved",
  "rejected",
  "pickup_scheduled",
  "original_in_transit",
  "original_received",
  "inspection_passed",
  "inspection_failed",
  "replacement_pending",
  "replacement_shipped",
  "completed",
  "cancelled",
];

const populateExchangeDetails = [
  { path: "order", select: "orderNumber orderStatus paymentStatus totalAmount currency" },
  { path: "user", select: "name email phone" },
];

/*
|--------------------------------------------------------------------------
| Allowed Admin Workflow Transitions
|--------------------------------------------------------------------------
*/

const allowedTransitions = {
  approved: ["pickup_scheduled"],
  pickup_scheduled: ["original_in_transit"],
  original_in_transit: ["original_received"],
  original_received: [
    "inspection_passed",
    "inspection_failed",
  ],
  inspection_passed: ["replacement_pending"],
  replacement_pending: ["replacement_shipped"],
  replacement_shipped: ["completed"],
};

/*
|--------------------------------------------------------------------------
| Validate Request Body
|--------------------------------------------------------------------------
*/

const validateBodyObject = (data) => {
  if (
    !data ||
    typeof data !== "object" ||
    Array.isArray(data)
  ) {
    throw createError(
      "Request body must be a valid object.",
      400
    );
  }
};

const validateTextField = (
  value,
  fieldName,
  maxLength = 200
) => {
  if (value === undefined || value === null) {
    return undefined;
  }

  if (typeof value !== "string") {
    throw createError(
      `${fieldName} must be a string.`,
      400
    );
  }

  const normalizedValue = value.trim();

  if (normalizedValue.length > maxLength) {
    throw createError(
      `${fieldName} cannot exceed ${maxLength} characters.`,
      400
    );
  }

  return normalizedValue;
};

/*
|--------------------------------------------------------------------------
| 1. List Admin Exchange Requests
|--------------------------------------------------------------------------
|
| GET /api/v1/admin/exchanges
|
| Query parameters:
| page, limit, status
|
*/

export const listAdminExchangeRequests = async (
  options = {}
) => {
  const page = Number(options.page ?? 1);
  const limit = Number(options.limit ?? 20);

  if (!Number.isInteger(page) || page < 1) {
    throw createError(
      "Page must be a positive integer.",
      400
    );
  }

  if (
    !Number.isInteger(limit) ||
    limit < 1 ||
    limit > 100
  ) {
    throw createError(
      "Limit must be an integer between 1 and 100.",
      400
    );
  }

  const filter = {};

  if (options.status !== undefined && options.status !== "") {
    if (!exchangeStatuses.includes(options.status)) {
      throw createError(
        "Invalid exchange request status filter.",
        400
      );
    }

    filter.status = options.status;
  }

  const skip = (page - 1) * limit;

  const [requests, total] = await Promise.all([
    ExchangeRequest.find(filter)
      .populate(populateExchangeDetails)
      .sort({
        createdAt: -1,
        _id: -1,
      })
      .skip(skip)
      .limit(limit)
      .lean(),

    ExchangeRequest.countDocuments(filter),
  ]);

  return {
    requests,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  };
};

/*
|--------------------------------------------------------------------------
| 2. Get Admin Exchange Request By ID
|--------------------------------------------------------------------------
|
| GET /api/v1/admin/exchanges/:exchangeRequestId
|
*/

export const getAdminExchangeRequestById = async (
  exchangeRequestId
) => {
  const validatedId = validateObjectId(
    exchangeRequestId,
    "exchange request ID"
  );

  const exchangeRequest = await ExchangeRequest.findById(
    validatedId
  )
    .populate(populateExchangeDetails)
    .lean();

  if (!exchangeRequest) {
    throw createError(
      "Exchange request not found.",
      404
    );
  }

  return exchangeRequest;
};

/*
|--------------------------------------------------------------------------
| 3. Review Exchange Request
|--------------------------------------------------------------------------
|
| PATCH /api/v1/admin/exchanges/:exchangeRequestId/review
|
| Accepted statuses:
| approved, rejected
|
*/

export const reviewAdminExchangeRequest = async (
  exchangeRequestId,
  adminId,
  data
) => {
  const validatedId = validateObjectId(
    exchangeRequestId,
    "exchange request ID"
  );

  const validatedAdminId = validateObjectId(
    String(adminId ?? ""),
    "admin ID"
  );

  validateBodyObject(data);

  const allowedFields = [
    "status",
    "rejectionReason",
  ];

  const unknownFields = Object.keys(data).filter(
    (field) => !allowedFields.includes(field)
  );

  if (unknownFields.length > 0) {
    throw createError(
      `Unsupported field(s): ${unknownFields.join(", ")}.`,
      400
    );
  }

  if (!["approved", "rejected"].includes(data.status)) {
    throw createError(
      "Review status must be either approved or rejected.",
      400
    );
  }

  let rejectionReason;

  if (data.status === "rejected") {
    rejectionReason = validateTextField(
      data.rejectionReason,
      "Rejection reason",
      1500
    );

    if (!rejectionReason) {
      throw createError(
        "A rejection reason is required when rejecting an exchange.",
        400
      );
    }
  }

  const session = await mongoose.startSession();
  let exchangeRequest;

  try {
    await session.withTransaction(async () => {
      const currentRequest = await ExchangeRequest.findById(
        validatedId
      )
        .session(session)
        .lean();

      if (!currentRequest) {
        throw createError("Exchange request not found.", 404);
      }

      if (!["requested", "under_review"].includes(currentRequest.status)) {
        throw createError(
          `This exchange request cannot be reviewed while its status is "${currentRequest.status}".`,
          409
        );
      }

      const update = {
        $set: {
          status: data.status,
          reviewedBy: validatedAdminId,
          reviewedAt: new Date(),
        },
      };

      if (data.status === "rejected") {
        update.$set.rejectionReason = rejectionReason;
      } else {
        update.$unset = { rejectionReason: 1 };
      }

      exchangeRequest = await ExchangeRequest.findOneAndUpdate(
        {
          _id: validatedId,
          status: { $in: ["requested", "under_review"] },
        },
        update,
        {
          returnDocument: "after",
          runValidators: true,
          session,
        }
      ).lean();

      if (!exchangeRequest) {
        throw createError(
          "The exchange request changed while it was being reviewed. Refresh and retry.",
          409
        );
      }

      if (data.status === "rejected") {
        await releaseReturnExchangeQuantity({
          orderId: currentRequest.order,
          orderItemId: currentRequest.orderItemId,
          quantity: currentRequest.quantity,
          session,
        });
      }
    });

    await emitCustomerNotification({
      recipientId: exchangeRequest.user,
      type: "exchange",
      title: "Exchange request updated",
      message: `Your exchange request ${exchangeRequest.exchangeNumber} is now ${exchangeRequest.status.replaceAll("_", " ")}.`,
      relatedOrder: exchangeRequest.order,
      actionUrl: `/account/exchanges/${exchangeRequest._id}`,
      idempotencyKey: `exchange.status:${exchangeRequest._id}:${exchangeRequest.status}`,
    });
    return exchangeRequest;
  } finally {
    await session.endSession();
  }
};

export const settleExchangePriceDifference = async (
  exchangeRequestId,
  adminId,
  data
) => {
  const validatedId = validateObjectId(
    exchangeRequestId,
    "exchange request ID"
  );
  const validatedAdminId = validateObjectId(
    String(adminId ?? ""),
    "admin ID"
  );

  validateBodyObject(data);

  const allowedFields = ["status", "reference"];
  const unknownFields = Object.keys(data).filter(
    (field) => !allowedFields.includes(field)
  );

  if (unknownFields.length > 0) {
    throw createError(
      `Unsupported field(s): ${unknownFields.join(", ")}.`,
      400
    );
  }

  const reference = validateTextField(
    data.reference,
    "Settlement reference",
    150
  );

  if (!reference) {
    throw createError(
      "A verified payment/refund reference is required.",
      400
    );
  }

  if (!["paid", "refunded"].includes(data.status)) {
    throw createError(
      'Settlement status must be "paid" or "refunded".',
      400
    );
  }

  const session = await mongoose.startSession();
  let exchangeRequest;

  try {
    await session.withTransaction(async () => {
      const currentRequest = await ExchangeRequest.findById(
        validatedId
      )
        .session(session)
        .lean();

      if (!currentRequest) {
        throw createError("Exchange request not found.", 404);
      }

      if (
        currentRequest.status !== "replacement_pending" ||
        currentRequest.priceDifferenceStatus === "not_applicable"
      ) {
        throw createError(
          "Price difference can only be settled for a replacement_pending exchange with a non-zero difference.",
          409
        );
      }

      const requiredSettlement =
        currentRequest.priceDifference > 0 ? "paid" : "refunded";

      if (data.status !== requiredSettlement) {
        throw createError(
          `This exchange requires the price difference to be ${requiredSettlement}.`,
          400
        );
      }

      exchangeRequest = await ExchangeRequest.findOneAndUpdate(
        {
          _id: validatedId,
          status: "replacement_pending",
          priceDifferenceStatus: "pending",
        },
        {
          $set: {
            priceDifferenceStatus: data.status,
            priceDifferenceReference: reference,
            priceDifferenceSettledAt: new Date(),
            priceDifferenceSettledBy: validatedAdminId,
          },
        },
        {
          returnDocument: "after",
          runValidators: true,
          session,
        }
      ).lean();

      if (!exchangeRequest) {
        throw createError(
          "The exchange settlement changed during this operation. Refresh and retry.",
          409
        );
      }
    });

    return exchangeRequest;
  } finally {
    await session.endSession();
  }
};

/*
|--------------------------------------------------------------------------
| 4. Advance Exchange Workflow
|--------------------------------------------------------------------------
|
| PATCH /api/v1/admin/exchanges/:exchangeRequestId/workflow
|
*/

export const transitionAdminExchangeRequest = async (
  exchangeRequestId,
  data
) => {
  const validatedId = validateObjectId(
    exchangeRequestId,
    "exchange request ID"
  );

  validateBodyObject(data);

  const allowedFields = [
    "status",
    "originalPickupCarrier",
    "originalPickupTrackingNumber",
    "replacementCarrier",
    "replacementTrackingNumber",
    "inspectionNotes",
  ];

  const unknownFields = Object.keys(data).filter(
    (field) => !allowedFields.includes(field)
  );

  if (unknownFields.length > 0) {
    throw createError(
      `Unsupported field(s): ${unknownFields.join(", ")}.`,
      400
    );
  }

  const targetStatus = data.status;

  const knownTargetStatuses = Object.values(
    allowedTransitions
  ).flat();

  if (
    typeof targetStatus !== "string" ||
    !knownTargetStatuses.includes(targetStatus)
  ) {
    throw createError(
      "Invalid exchange workflow status.",
      400
    );
  }

  const session = await mongoose.startSession();
  let updatedRequest;

  try {
    await session.withTransaction(async () => {
      const currentRequest = await ExchangeRequest.findById(
        validatedId
      )
        .session(session)
        .lean();

      if (!currentRequest) {
        throw createError("Exchange request not found.", 404);
      }

      const permittedTargets =
        allowedTransitions[currentRequest.status] || [];

      if (!permittedTargets.includes(targetStatus)) {
        throw createError(
          `Cannot transition exchange from "${currentRequest.status}" to "${targetStatus}".`,
          409
        );
      }

      const updateFields = {
        status: targetStatus,
      };

  /*
   * Pickup details can be recorded when scheduling pickup.
   */
  if (targetStatus === "pickup_scheduled") {
    const carrier = validateTextField(
      data.originalPickupCarrier,
      "Original pickup carrier",
      150
    );

    const trackingNumber = validateTextField(
      data.originalPickupTrackingNumber,
      "Original pickup tracking number",
      200
    );

    if (carrier) {
      updateFields.originalPickupCarrier = carrier;
    }

    if (trackingNumber) {
      updateFields.originalPickupTrackingNumber =
        trackingNumber;
    }
  }

  /*
   * Before the original item moves in transit, require tracking
   * information to be available.
   */
  if (targetStatus === "original_in_transit") {
    const carrier =
      validateTextField(
        data.originalPickupCarrier,
        "Original pickup carrier",
        150
      ) ??
      currentRequest.originalPickupCarrier;

    const trackingNumber =
      validateTextField(
        data.originalPickupTrackingNumber,
        "Original pickup tracking number",
        200
      ) ??
      currentRequest.originalPickupTrackingNumber;

    if (!carrier || !trackingNumber) {
      throw createError(
        "Original pickup carrier and tracking number are required before marking the original item in transit.",
        400
      );
    }

    updateFields.originalPickupCarrier = carrier;
    updateFields.originalPickupTrackingNumber =
      trackingNumber;
  }

  /*
   * Inspection failure must include an explanatory note.
   */
  if (
    targetStatus === "inspection_passed" ||
    targetStatus === "inspection_failed"
  ) {
    const inspectionNotes = validateTextField(
      data.inspectionNotes,
      "Inspection notes",
      2000
    );

    if (
      targetStatus === "inspection_failed" &&
      !(
        inspectionNotes ??
        currentRequest.inspectionNotes
      )
    ) {
      throw createError(
        "Inspection notes are required when inspection fails.",
        400
      );
    }

    if (inspectionNotes !== undefined) {
      updateFields.inspectionNotes = inspectionNotes;
    }
  }

  /*
   * Replacement shipment requires both carrier and tracking.
   */
  if (targetStatus === "replacement_shipped") {
    const carrier = validateTextField(
      data.replacementCarrier,
      "Replacement carrier",
      150
    );

    const trackingNumber = validateTextField(
      data.replacementTrackingNumber,
      "Replacement tracking number",
      200
    );

    if (!carrier || !trackingNumber) {
      throw createError(
        "Replacement carrier and tracking number are required before shipping the replacement.",
        400
      );
    }

    updateFields.replacementCarrier = carrier;
    updateFields.replacementTrackingNumber =
      trackingNumber;

    updateFields.replacementShippedAt = new Date();

    if (
      currentRequest.priceDifferenceStatus === "pending"
    ) {
      throw createError(
        "Settle the exchange price difference before shipping the replacement.",
        409
      );
    }

    if (
      !currentRequest.replacementInventoryReserved ||
      !currentRequest.replacementInventory
    ) {
      throw createError(
        "Replacement inventory is not reserved for this exchange.",
        409
      );
    }

    const inventoryResult = await Inventory.updateOne(
      {
        _id: currentRequest.replacementInventory,
        quantity: { $gte: currentRequest.quantity },
        reservedQuantity: { $gte: currentRequest.quantity },
      },
      {
        $inc: {
          quantity: -currentRequest.quantity,
          reservedQuantity: -currentRequest.quantity,
        },
      },
      { session, runValidators: true }
    );

    if (inventoryResult.modifiedCount !== 1) {
      throw createError(
        "Reserved replacement stock could not be committed. Inventory requires review.",
        409
      );
    }

    updateFields.replacementInventoryReserved = false;
  }

  if (targetStatus === "original_received") {
    updateFields.originalReceivedAt = new Date();
  }

  if (targetStatus === "completed") {
    updateFields.completedAt = new Date();
  }

  /*
   * Compare the expected current status in the update itself.
   * If another admin changes it first, this update will not win.
   */
  if (targetStatus === "replacement_pending") {
    const inventory = await Inventory.findOneAndUpdate(
      {
        product: currentRequest.requestedProduct,
        variant: currentRequest.requestedVariant ?? null,
        inventoryType: currentRequest.requestedVariant
          ? "variant"
          : "product",
        $expr: {
          $gte: [
            {
              $subtract: [
                "$quantity",
                "$reservedQuantity",
              ],
            },
            currentRequest.quantity,
          ],
        },
      },
      {
        $inc: {
          reservedQuantity: currentRequest.quantity,
        },
      },
      {
        returnDocument: "after",
        runValidators: true,
        session,
      }
    ).lean();

    if (!inventory) {
      throw createError(
        "Insufficient replacement inventory. Restock before continuing this exchange.",
        409
      );
    }

    updateFields.replacementInventory = inventory._id;
    updateFields.replacementInventoryReserved = true;
  }

  updatedRequest = await ExchangeRequest.findOneAndUpdate(
      {
        _id: validatedId,
        status: currentRequest.status,
      },
      {
        $set: updateFields,
      },
      {
        returnDocument: "after",
        runValidators: true,
        session,
      }
    ).lean();

      if (!updatedRequest) {
        throw createError(
          "The exchange status changed during this operation. Refresh the request and try again.",
          409
        );
      }

      if (targetStatus === "inspection_failed") {
        await releaseReturnExchangeQuantity({
          orderId: currentRequest.order,
          orderItemId: currentRequest.orderItemId,
          quantity: currentRequest.quantity,
          session,
        });
      } else if (targetStatus === "completed") {
        await completeReturnExchangeQuantity({
          orderId: currentRequest.order,
          orderItemId: currentRequest.orderItemId,
          quantity: currentRequest.quantity,
          session,
        });
      }
    });

    await emitCustomerNotification({
      recipientId: updatedRequest.user,
      type: "exchange",
      title: "Exchange request updated",
      message: `Your exchange request ${updatedRequest.exchangeNumber} is now ${updatedRequest.status.replaceAll("_", " ")}.`,
      relatedOrder: updatedRequest.order,
      actionUrl: `/account/exchanges/${updatedRequest._id}`,
      idempotencyKey: `exchange.status:${updatedRequest._id}:${updatedRequest.status}`,
    });
    return updatedRequest;
  } finally {
    await session.endSession();
  }
};