import { randomBytes } from "node:crypto";
import mongoose from "mongoose";

import ReturnRequest from "../models/ReturnRequest.js";
import Order from "../models/Order.js";
import StoreSettings from "../models/StoreSettings.js";
import { RETURN_EXCHANGE_WINDOW_DAYS } from "./businessPolicy.js";
import {
  releaseReturnExchangeQuantity,
  reserveReturnExchangeQuantity,
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

const validateUserId = (userId) => {
  return validateObjectId(
    String(userId ?? ""),
    "customer ID"
  );
};

const validateObject = (data, allowedFields) => {
  if (
    !data ||
    typeof data !== "object" ||
    Array.isArray(data)
  ) {
    throw createError(
      "Request data must be a valid object.",
      400
    );
  }

  const unknownFields = Object.keys(data).filter(
    (field) => !allowedFields.includes(field)
  );

  if (unknownFields.length > 0) {
    throw createError(
      `Unsupported field(s): ${unknownFields.join(", ")}.`,
      400
    );
  }
};

const generateReturnNumber = () => {
  const date = new Date()
    .toISOString()
    .slice(0, 10)
    .replace(/-/g, "");

  const uniquePart = randomBytes(4)
    .toString("hex")
    .toUpperCase();

  return `NIA-RET-${date}-${uniquePart}`;
};

/*
|--------------------------------------------------------------------------
| Input Validation
|--------------------------------------------------------------------------
*/

const allowedReasons = [
  "damaged_product",
  "wrong_product",
  "different_from_description",
  "quality_issue",
  "size_or_fit",
  "other",
];

const validateReturnInput = (data) => {
  validateObject(data, [
    "orderId",
    "orderItemId",
    "quantity",
    "reason",
    "reasonDetails",
    "evidenceImages",
  ]);

  const orderId = validateObjectId(
    data.orderId,
    "order ID"
  );

  const orderItemId = validateObjectId(
    data.orderItemId,
    "order item ID"
  );

  const quantity = Number(data.quantity);

  if (
    !Number.isInteger(quantity) ||
    quantity < 1 ||
    quantity > 20
  ) {
    throw createError(
      "Return quantity must be a whole number between 1 and 20.",
      400
    );
  }

  if (!allowedReasons.includes(data.reason)) {
    throw createError(
      `Invalid return reason. Allowed reasons: ${allowedReasons.join(", ")}.`,
      400
    );
  }

  let reasonDetails = "";

  if (data.reasonDetails !== undefined) {
    if (
      typeof data.reasonDetails !== "string" ||
      data.reasonDetails.length > 1500
    ) {
      throw createError(
        "Reason details must be a string of at most 1500 characters.",
        400
      );
    }

    reasonDetails = data.reasonDetails.trim();
  }

  const evidenceImages = [];

  if (data.evidenceImages !== undefined) {
    if (
      !Array.isArray(data.evidenceImages) ||
      data.evidenceImages.length > 5
    ) {
      throw createError(
        "Evidence images must be an array containing at most 5 images.",
        400
      );
    }

    for (const image of data.evidenceImages) {
      if (
        !image ||
        typeof image !== "object" ||
        Array.isArray(image)
      ) {
        throw createError(
          "Each evidence image must be a valid object.",
          400
        );
      }

      const unknownImageFields = Object.keys(image).filter(
        (field) => !["url", "publicId"].includes(field)
      );

      if (unknownImageFields.length > 0) {
        throw createError(
          "Evidence images may contain only url and publicId.",
          400
        );
      }

      if (
        typeof image.url !== "string" ||
        image.url.length > 2048
      ) {
        throw createError(
          "Each evidence image must contain a valid URL.",
          400
        );
      }

      let parsedUrl;

      try {
        parsedUrl = new URL(image.url);
      } catch {
        throw createError(
          "An evidence image URL is invalid.",
          400
        );
      }

      if (parsedUrl.protocol !== "https:") {
        throw createError(
          "Evidence image URLs must use HTTPS.",
          400
        );
      }

      let publicId = null;

      if (image.publicId !== undefined && image.publicId !== null) {
        if (
          typeof image.publicId !== "string" ||
          image.publicId.length > 255
        ) {
          throw createError(
            "Image publicId must be a string of at most 255 characters.",
            400
          );
        }

        publicId = image.publicId.trim() || null;
      }

      evidenceImages.push({
        url: image.url,
        publicId,
      });
    }
  }

  return {
    orderId,
    orderItemId,
    quantity,
    reason: data.reason,
    reasonDetails,
    evidenceImages,
  };
};

/*
|--------------------------------------------------------------------------
| Store Return Policy
|--------------------------------------------------------------------------
|
| If a settings document does not exist yet, use the same
| defaults defined in StoreSettings.js.
|--------------------------------------------------------------------------
*/

const getReturnPolicy = async () => {
  const settings = await StoreSettings.findOne({
    key: "main",
  })
    .select("returnsEnabled returnWindowDays")
    .lean();

  return {
    enabled: settings?.returnsEnabled ?? true,
    windowDays: RETURN_EXCHANGE_WINDOW_DAYS,
  };
};

/*
|--------------------------------------------------------------------------
| Existing Return/Exchange Quantity
|--------------------------------------------------------------------------
|
| A customer must not request a return and an exchange for
| the same item quantity at the same time.
|
| Successful/completed requests continue to count against
| the purchased quantity.
|--------------------------------------------------------------------------
*/

/*
|--------------------------------------------------------------------------
| 1. Create Customer Return Request
|--------------------------------------------------------------------------
|
| Requirements:
| - Order must belong to the authenticated customer.
| - Order must be delivered.
| - Return period must not have expired.
| - The selected order item must exist.
| - Requested quantity must not exceed the available quantity.
|--------------------------------------------------------------------------
*/

export const createCustomerReturnRequest = async (
  userId,
  data
) => {
  const validatedUserId = validateUserId(userId);

  const input = validateReturnInput(data);

  const policy = await getReturnPolicy();

  if (!policy.enabled) {
    throw createError(
      "Product returns are currently disabled by the store.",
      409
    );
  }

  /*
   * Look up only this customer's order.
   * Never trust a frontend-supplied customer ID.
   */
  const order = await Order.findOne({
    _id: input.orderId,
    user: validatedUserId,
  }).lean();

  if (!order) {
    throw createError(
      "Order not found.",
      404
    );
  }

  if (order.orderStatus !== "delivered") {
    throw createError(
      "A return can only be requested for a delivered order.",
      409
    );
  }

  if (!order.deliveredAt) {
    throw createError(
      "The order delivery date is unavailable. Please contact store support.",
      409
    );
  }

  const deliveredAt = new Date(order.deliveredAt);

  if (Number.isNaN(deliveredAt.getTime())) {
    throw createError(
      "The order delivery date is invalid. Please contact store support.",
      409
    );
  }

  const returnDeadline = new Date(deliveredAt);

  returnDeadline.setDate(
    returnDeadline.getDate() + policy.windowDays
  );

  if (Date.now() > returnDeadline.getTime()) {
    throw createError(
      `The return window of ${policy.windowDays} days has expired.`,
      409
    );
  }

  /*
   * Find the exact purchased item using the embedded
   * order-item ID, rather than trusting product details
   * supplied by the frontend.
   */
  const orderItem = (order.items || []).find(
    (item) =>
      String(item._id) === input.orderItemId
  );

  if (!orderItem) {
    throw createError(
      "The selected item was not found in this order.",
      404
    );
  }

  /*
   * Product name, SKU and references are copied from the
   * stored order snapshot, never from the frontend.
   */
  const session = await mongoose.startSession();
  let returnRequest;

  try {
    await session.withTransaction(async () => {
      await reserveReturnExchangeQuantity({
        orderId: order._id,
        orderItemId: orderItem._id,
        purchasedQuantity: orderItem.quantity,
        quantity: input.quantity,
        session,
      });

      [returnRequest] = await ReturnRequest.create(
        [
          {
            returnNumber: generateReturnNumber(),

            order: order._id,
            orderItemId: orderItem._id,
            user: validatedUserId,

            product: orderItem.product,
            variant: orderItem.variant ?? null,

            productName: orderItem.productName,
            sku: orderItem.sku,

            quantity: input.quantity,

            reason: input.reason,
            reasonDetails: input.reasonDetails,
            evidenceImages: input.evidenceImages,

            status: "requested",
            requestedAt: new Date(),
            returnDeadline,
          },
        ],
        { session }
      );
    });

    const result = returnRequest.toObject();
    await emitCustomerNotification({
      recipientId: validatedUserId,
      type: "return",
      title: "Return request received",
      message: `Your return request ${result.returnNumber} was submitted.`,
      relatedOrder: order._id,
      actionUrl: `/account/returns/${result._id}`,
      idempotencyKey: `return.requested:${result._id}`,
    });
    return result;
  } catch (error) {
    if (error.code === 11000) {
      throw createError(
        "A duplicate return request number was detected. Please retry.",
        409
      );
    }

    if (
      error.name === "ValidationError" ||
      error.name === "CastError"
    ) {
      throw createError(error.message, 400);
    }

    throw error;
  } finally {
    await session.endSession();
  }
};

/*
|--------------------------------------------------------------------------
| 2. List Customer Return Requests
|--------------------------------------------------------------------------
|
| GET /api/v1/returns
|--------------------------------------------------------------------------
*/

export const listCustomerReturnRequests = async (
  userId,
  options = {}
) => {
  const validatedUserId = validateUserId(userId);

  const page = Number(options.page ?? 1);
  const limit = Number(options.limit ?? 20);

  if (
    !Number.isInteger(page) ||
    page < 1
  ) {
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

  const filter = {
    user: validatedUserId,
  };

  if (options.status) {
    const allowedStatuses = [
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

    if (!allowedStatuses.includes(options.status)) {
      throw createError(
        "Invalid return request status filter.",
        400
      );
    }

    filter.status = options.status;
  }

  const skip = (page - 1) * limit;

  const [requests, total] = await Promise.all([
    ReturnRequest.find(filter)
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
| 3. Get One Customer Return Request
|--------------------------------------------------------------------------
|
| GET /api/v1/returns/:returnRequestId
|--------------------------------------------------------------------------
*/

export const getCustomerReturnRequestById = async (
  userId,
  returnRequestId
) => {
  const validatedUserId = validateUserId(userId);

  const validatedReturnRequestId = validateObjectId(
    returnRequestId,
    "return request ID"
  );

  const returnRequest = await ReturnRequest.findOne({
    _id: validatedReturnRequestId,
    user: validatedUserId,
  }).lean();

  if (!returnRequest) {
    throw createError(
      "Return request not found.",
      404
    );
  }

  return returnRequest;
};

/*
|--------------------------------------------------------------------------
| 4. Cancel Customer Return Request
|--------------------------------------------------------------------------
|
| Customers may cancel only requests that are still
| in the initial requested state.
|--------------------------------------------------------------------------
*/

export const cancelCustomerReturnRequest = async (
  userId,
  returnRequestId
) => {
  const validatedUserId = validateUserId(userId);

  const validatedReturnRequestId = validateObjectId(
    returnRequestId,
    "return request ID"
  );

  const session = await mongoose.startSession();
  let updatedRequest;

  try {
    await session.withTransaction(async () => {
      const returnRequest = await ReturnRequest.findOne({
        _id: validatedReturnRequestId,
        user: validatedUserId,
      }).session(session);

      if (!returnRequest) {
        throw createError("Return request not found.", 404);
      }

      if (returnRequest.status !== "requested") {
        throw createError(
          "Only a return request that has not yet entered review can be cancelled by the customer.",
          409
        );
      }

      updatedRequest = await ReturnRequest.findOneAndUpdate(
        {
          _id: returnRequest._id,
          user: validatedUserId,
          status: "requested",
        },
        {
          $set: {
            status: "cancelled",
            cancelledAt: new Date(),
          },
        },
        {
          returnDocument: "after",
          runValidators: true,
          session,
        }
      );

      if (!updatedRequest) {
        throw createError(
          "The return request changed while being cancelled. Refresh and retry.",
          409
        );
      }

      await releaseReturnExchangeQuantity({
        orderId: returnRequest.order,
        orderItemId: returnRequest.orderItemId,
        quantity: returnRequest.quantity,
        session,
      });
    });

    return updatedRequest.toObject();
  } finally {
    await session.endSession();
  }
};
