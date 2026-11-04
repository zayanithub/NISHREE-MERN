import mongoose from "mongoose";
import ReturnRequest from "../models/ReturnRequest.js";
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

const isValidObjectId = (value) => {
  return (
    typeof value === "string" &&
    /^[a-f\d]{24}$/i.test(value)
  );
};

const validateObjectId = (value, fieldName) => {
  if (!isValidObjectId(String(value ?? ""))) {
    throw createError(`Invalid ${fieldName}.`, 400);
  }

  return String(value);
};

const validateAdminId = (adminId) => {
  return validateObjectId(adminId, "admin ID");
};

const validateRequestId = (requestId) => {
  return validateObjectId(
    requestId,
    "return request ID"
  );
};

/*
|--------------------------------------------------------------------------
| Populate Configuration
|--------------------------------------------------------------------------
*/

const populateReturnDetails = [
  {
    path: "order",
    select:
      "orderNumber orderStatus paymentStatus paymentMethod deliveredAt totalAmount currency",
  },
  {
    path: "user",
    select: "name email phone",
  },
];

/*
|--------------------------------------------------------------------------
| Allowed Return Statuses
|--------------------------------------------------------------------------
*/

const allowedReturnStatuses = [
  "requested",
  "under_review",
  "approved",
  "rejected",
  "pickup_scheduled",
  "in_transit",
  "received",
  "inspection_passed",
  "inspection_failed",
  "refund_pending",
  "completed",
  "cancelled",
];

/*
|--------------------------------------------------------------------------
| Pagination
|--------------------------------------------------------------------------
*/

const parsePagination = (options = {}) => {
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

  return { page, limit };
};

/*
|--------------------------------------------------------------------------
| 1. List Return Requests For Admin
|--------------------------------------------------------------------------
|
| GET /api/v1/admin/returns
|
| Query:
| page, limit, status, search
|--------------------------------------------------------------------------
*/

export const listAdminReturnRequests = async (
  options = {}
) => {
  const { page, limit } = parsePagination(options);

  const filter = {};

  if (options.status) {
    if (!allowedReturnStatuses.includes(options.status)) {
      throw createError(
        "Invalid return request status filter.",
        400
      );
    }

    filter.status = options.status;
  }

  if (
    typeof options.search === "string" &&
    options.search.trim()
  ) {
    const searchText = options.search.trim();

    if (searchText.length > 100) {
      throw createError(
        "Search text cannot exceed 100 characters.",
        400
      );
    }

    const escapedSearch = searchText.replace(
      /[.*+?^${}()|[\]\\]/g,
      "\\$&"
    );

    const searchRegex = new RegExp(
      escapedSearch,
      "i"
    );

    filter.$or = [
      { returnNumber: searchRegex },
      { productName: searchRegex },
      { sku: searchRegex },
      { reasonDetails: searchRegex },
    ];
  }

  const skip = (page - 1) * limit;

  const [requests, total] = await Promise.all([
    ReturnRequest.find(filter)
      .populate(populateReturnDetails)
      .sort({
        createdAt: -1,
        _id: -1,
      })
      .skip(skip)
      .limit(limit)
      .lean(),

    ReturnRequest.countDocuments(filter),
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
| 2. Get One Return Request For Admin
|--------------------------------------------------------------------------
|
| GET /api/v1/admin/returns/:returnRequestId
|--------------------------------------------------------------------------
*/

export const getAdminReturnRequestById = async (
  returnRequestId
) => {
  const validatedRequestId =
    validateRequestId(returnRequestId);

  const request = await ReturnRequest.findById(
    validatedRequestId
  )
    .populate(populateReturnDetails)
    .lean();

  if (!request) {
    throw createError(
      "Return request not found.",
      404
    );
  }

  return request;
};

/*
|--------------------------------------------------------------------------
| 3. Review, Approve Or Reject Return Request
|--------------------------------------------------------------------------
|
| PATCH /api/v1/admin/returns/:returnRequestId/review
|
| Under review:
| { "decision": "under_review" }
|
| Approve:
| { "decision": "approve" }
|
| Reject:
| {
|   "decision": "reject",
|   "rejectionReason": "Reason for rejection"
| }
|--------------------------------------------------------------------------
*/

export const reviewAdminReturnRequest = async (
  adminId,
  returnRequestId,
  data
) => {
  const validatedAdminId =
    validateAdminId(adminId);

  const validatedRequestId =
    validateRequestId(returnRequestId);

  if (
    !data ||
    typeof data !== "object" ||
    Array.isArray(data)
  ) {
    throw createError(
      "Review data must be a valid object.",
      400
    );
  }

  const allowedFields = [
    "decision",
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

  const { decision } = data;

  if (
    !["under_review", "approve", "reject"].includes(
      decision
    )
  ) {
    throw createError(
      'Decision must be "under_review", "approve", or "reject".',
      400
    );
  }

  let rejectionReason = "";

  if (decision === "reject") {
    if (
      typeof data.rejectionReason !== "string" ||
      !data.rejectionReason.trim() ||
      data.rejectionReason.trim().length > 1000
    ) {
      throw createError(
        "A rejection reason between 1 and 1000 characters is required.",
        400
      );
    }

    rejectionReason = data.rejectionReason.trim();
  } else if (data.rejectionReason !== undefined) {
    throw createError(
      "A rejection reason is allowed only when rejecting a return request.",
      400
    );
  }

  const session = await mongoose.startSession();
  let updatedRequest;

  try {
    await session.withTransaction(async () => {
      const currentRequest = await ReturnRequest.findById(
        validatedRequestId
      ).session(session);

      if (!currentRequest) {
        throw createError("Return request not found.", 404);
      }

      const reviewableStatuses = [
        "requested",
        "under_review",
      ];

      if (!reviewableStatuses.includes(currentRequest.status)) {
        throw createError(
          `A return request with status "${currentRequest.status}" cannot be reviewed again.`,
          409
        );
      }

      if (
        decision === "under_review" &&
        currentRequest.status === "under_review"
      ) {
        updatedRequest = currentRequest;
        return;
      }

      const now = new Date();
      const update = {
        reviewedBy: validatedAdminId,
        reviewedAt: now,
      };

      let expectedStatuses = ["requested", "under_review"];

      if (decision === "under_review") {
        update.status = "under_review";
        expectedStatuses = ["requested"];
      }

      if (decision === "approve") {
        update.status = "approved";
        update.approvedAt = now;
        update.rejectedAt = null;
        update.rejectionReason = null;
      }

      if (decision === "reject") {
        update.status = "rejected";
        update.rejectedAt = now;
        update.rejectionReason = rejectionReason;
        update.approvedAt = null;
      }

      updatedRequest = await ReturnRequest.findOneAndUpdate(
        {
          _id: validatedRequestId,
          status: { $in: expectedStatuses },
        },
        { $set: update },
        {
          returnDocument: "after",
          runValidators: true,
          session,
        }
      );

      if (!updatedRequest) {
        throw createError(
          "The return request was updated by another action. Refresh and retry.",
          409
        );
      }

      if (decision === "reject") {
        await releaseReturnExchangeQuantity({
          orderId: currentRequest.order,
          orderItemId: currentRequest.orderItemId,
          quantity: currentRequest.quantity,
          session,
        });
      }
    });

    const result = updatedRequest.toObject();
    await emitCustomerNotification({
      recipientId: result.user,
      type: "return",
      title: "Return request updated",
      message: `Your return request ${result.returnNumber} is now ${result.status.replaceAll("_", " ")}.`,
      relatedOrder: result.order,
      actionUrl: `/account/returns/${result._id}`,
      idempotencyKey: `return.status:${result._id}:${result.status}`,
    });
    return result;
  } finally {
    await session.endSession();
  }
};

/*
|--------------------------------------------------------------------------
| 4. Advance Return Pickup and Inspection Workflow
|--------------------------------------------------------------------------
|
| Allowed transitions:
| approved -> pickup_scheduled
| pickup_scheduled -> in_transit
| in_transit -> received
| received -> inspection_passed / inspection_failed
| inspection_passed -> refund_pending
|
| Refund processing is handled separately.
|--------------------------------------------------------------------------
*/

const allowedAdminReturnTransitions = {
  approved: ["pickup_scheduled"],
  pickup_scheduled: ["in_transit"],
  in_transit: ["received"],
  received: ["inspection_passed", "inspection_failed"],
  inspection_passed: ["refund_pending"],
  inspection_failed: [],
};

export const transitionAdminReturnRequest = async (
  adminId,
  returnRequestId,
  data
) => {
  const validatedAdminId = validateAdminId(adminId);
  const validatedRequestId =
    validateRequestId(returnRequestId);

  if (
    !data ||
    typeof data !== "object" ||
    Array.isArray(data)
  ) {
    throw createError(
      "Return workflow data must be a valid object.",
      400
    );
  }

  const allowedFields = [
    "status",
    "pickupCarrier",
    "pickupTrackingNumber",
    "inspectionNotes",
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

  const { status } = data;

const isKnownTargetStatus = Object.values(
  allowedAdminReturnTransitions
).some((statuses) => statuses.includes(status));

if (
  typeof status !== "string" ||
  !isKnownTargetStatus
) {
  throw createError(
    "Invalid return workflow status.",
    400
  );
}

  const session = await mongoose.startSession();
  let updatedRequest;

  try {
    await session.withTransaction(async () => {
      const returnRequest = await ReturnRequest.findById(
        validatedRequestId
      ).session(session);

      if (!returnRequest) {
        throw createError("Return request not found.", 404);
      }

      const allowedNextStatuses =
        allowedAdminReturnTransitions[returnRequest.status] || [];

      if (!allowedNextStatuses.includes(status)) {
        throw createError(
          `Return request cannot transition from "${returnRequest.status}" to "${status}".`,
          409
        );
      }

      const update = {
        status,
        reviewedBy: validatedAdminId,
        reviewedAt: new Date(),
      };

  const normalizeRequiredText = (
    value,
    fieldName,
    maxLength
  ) => {
    if (
      typeof value !== "string" ||
      !value.trim() ||
      value.trim().length > maxLength
    ) {
      throw createError(
        `${fieldName} must contain between 1 and ${maxLength} characters.`,
        400
      );
    }

    return value.trim();
  };

  const normalizeOptionalText = (
    value,
    fieldName,
    maxLength
  ) => {
    if (value === undefined) {
      return undefined;
    }

    if (
      typeof value !== "string" ||
      value.trim().length > maxLength
    ) {
      throw createError(
        `${fieldName} must be a string of at most ${maxLength} characters.`,
        400
      );
    }

    return value.trim();
  };

  if (status === "pickup_scheduled") {
    update.pickupCarrier = normalizeRequiredText(
      data.pickupCarrier,
      "Pickup carrier",
      120
    );

    const trackingNumber = normalizeOptionalText(
      data.pickupTrackingNumber,
      "Pickup tracking number",
      100
    );

    if (trackingNumber !== undefined) {
      update.pickupTrackingNumber = trackingNumber || null;
    }
  } else if (
    data.pickupCarrier !== undefined ||
    data.pickupTrackingNumber !== undefined
  ) {
    throw createError(
      "Pickup carrier and tracking details can only be supplied when scheduling pickup.",
      400
    );
  }

  if (
    data.inspectionNotes !== undefined
  ) {
    update.inspectionNotes = normalizeOptionalText(
      data.inspectionNotes,
      "Inspection notes",
      1500
    );
  }

  if (status === "inspection_failed") {
    update.rejectionReason = normalizeRequiredText(
      data.rejectionReason,
      "Inspection failure reason",
      1000
    );

    if (!update.inspectionNotes) {
      update.inspectionNotes =
        returnRequest.inspectionNotes || "";
    }
  } else if (data.rejectionReason !== undefined) {
    throw createError(
      "Rejection reason can only be supplied when inspection fails.",
      400
    );
  }

  if (status === "received") {
    update.receivedAt = new Date();
  }

      updatedRequest = await ReturnRequest.findOneAndUpdate(
        {
          _id: validatedRequestId,
          status: returnRequest.status,
        },
        { $set: update },
        {
          returnDocument: "after",
          runValidators: true,
          session,
        }
      );

      if (!updatedRequest) {
        throw createError(
          "The return request changed during this operation. Refresh and retry.",
          409
        );
      }

      if (status === "inspection_failed") {
        await releaseReturnExchangeQuantity({
          orderId: returnRequest.order,
          orderItemId: returnRequest.orderItemId,
          quantity: returnRequest.quantity,
          session,
        });
      }
    });

    const result = updatedRequest.toObject();
    await emitCustomerNotification({
      recipientId: result.user,
      type: "return",
      title: "Return request updated",
      message: `Your return request ${result.returnNumber} is now ${result.status.replaceAll("_", " ")}.`,
      relatedOrder: result.order,
      actionUrl: `/account/returns/${result._id}`,
      idempotencyKey: `return.status:${result._id}:${result.status}`,
    });
    return result;
  } finally {
    await session.endSession();
  }
};