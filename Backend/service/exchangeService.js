import { randomBytes } from "node:crypto";
import mongoose from "mongoose";

import ExchangeRequest from "../models/ExchangeRequest.js";
import Order from "../models/Order.js";
import StoreSettings from "../models/StoreSettings.js";
import { RETURN_EXCHANGE_WINDOW_DAYS } from "./businessPolicy.js";
import Product from "../models/Product.js";
import ProductVariant from "../models/ProductVariant.js";
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

const isValidObjectId = (value) =>
  typeof value === "string" &&
  /^[a-f\d]{24}$/i.test(value);

const validateObjectId = (value, fieldName) => {
  if (!isValidObjectId(String(value ?? ""))) {
    throw createError(`Invalid ${fieldName}.`, 400);
  }

  return String(value);
};

const validateUserId = (userId) =>
  validateObjectId(String(userId ?? ""), "customer ID");

const roundMoney = (amount) =>
  Math.round((amount + Number.EPSILON) * 100) / 100;

const generateExchangeNumber = () => {
  const date = new Date()
    .toISOString()
    .slice(0, 10)
    .replace(/-/g, "");

  const uniquePart = randomBytes(4)
    .toString("hex")
    .toUpperCase();

  return `NIA-EXC-${date}-${uniquePart}`;
};

/*
|--------------------------------------------------------------------------
| Exchange Statuses
|--------------------------------------------------------------------------
*/

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

/*
|--------------------------------------------------------------------------
| Store Exchange Policy
|--------------------------------------------------------------------------
*/

const getExchangePolicy = async () => {
  const settings = await StoreSettings.findOne({
    key: "main",
  })
    .select("exchangesEnabled exchangeWindowDays")
    .lean();

  return {
    enabled: settings?.exchangesEnabled ?? true,
    windowDays: RETURN_EXCHANGE_WINDOW_DAYS,
  };
};

/*
|--------------------------------------------------------------------------
| Customer Input Validation
|--------------------------------------------------------------------------
*/

const validateExchangeInput = (data) => {
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

  const allowedFields = [
    "orderId",
    "orderItemId",
    "quantity",
    "requestedProductId",
    "requestedVariantId",
    "reason",
    "reasonDetails",
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

  const orderId = validateObjectId(
    data.orderId,
    "order ID"
  );

  const orderItemId = validateObjectId(
    data.orderItemId,
    "order item ID"
  );

  const requestedProductId = validateObjectId(
    data.requestedProductId,
    "requested product ID"
  );

  let requestedVariantId = null;

  if (
    data.requestedVariantId !== undefined &&
    data.requestedVariantId !== null &&
    data.requestedVariantId !== ""
  ) {
    requestedVariantId = validateObjectId(
      data.requestedVariantId,
      "requested variant ID"
    );
  }

  const quantity = Number(data.quantity);

  if (
    !Number.isInteger(quantity) ||
    quantity < 1 ||
    quantity > 20
  ) {
    throw createError(
      "Exchange quantity must be a whole number between 1 and 20.",
      400
    );
  }

  const allowedReasons = [
    "wrong_product",
    "damaged_product",
    "different_from_description",
    "size_or_fit",
    "color_change",
    "other",
  ];

  if (!allowedReasons.includes(data.reason)) {
    throw createError(
      `Invalid exchange reason. Allowed reasons: ${allowedReasons.join(", ")}.`,
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

  return {
    orderId,
    orderItemId,
    quantity,
    requestedProductId,
    requestedVariantId,
    reason: data.reason,
    reasonDetails,
  };
};

/*
|--------------------------------------------------------------------------
| Requested Product and Variant
|--------------------------------------------------------------------------
*/

const getRequestedProductDetails = async (
  requestedProductId,
  requestedVariantId
) => {
  const product = await Product.findOne({
    _id: requestedProductId,
    status: "active",
  })
    .select("name sku basePrice salePrice variants")
    .lean();

  if (!product) {
    throw createError(
      "The requested replacement product is unavailable.",
      404
    );
  }

  let variant = null;

  if (requestedVariantId) {
    variant = await ProductVariant.findOne({
      _id: requestedVariantId,
      product: product._id,
      isActive: true,
    })
      .select("sku name priceAdjustment")
      .lean();

    if (!variant) {
      throw createError(
        "The selected variant is invalid or unavailable for this product.",
        400
      );
    }
  } else if (
    Array.isArray(product.variants) &&
    product.variants.length > 0
  ) {
    throw createError(
      "Please select a variant for the requested product.",
      400
    );
  }

  const basePrice =
    product.salePrice ?? product.basePrice;

  const priceAdjustment = variant
    ? Number(variant.priceAdjustment ?? 0)
    : 0;

  const requestedUnitPrice = roundMoney(
    Number(basePrice) + priceAdjustment
  );

  if (
    !Number.isFinite(requestedUnitPrice) ||
    requestedUnitPrice < 0
  ) {
    throw createError(
      "The requested product has an invalid price.",
      409
    );
  }

  return {
    product,
    variant,
    requestedUnitPrice,
    requestedSku: variant?.sku || product.sku,
  };
};

/*
|--------------------------------------------------------------------------
| 1. Create Customer Exchange Request
|--------------------------------------------------------------------------
|
| POST /api/v1/exchanges
|
*/

export const createCustomerExchangeRequest = async (
  userId,
  data
) => {
  const validatedUserId = validateUserId(userId);
  const input = validateExchangeInput(data);

  const policy = await getExchangePolicy();

  if (!policy.enabled) {
    throw createError(
      "Product exchanges are currently disabled by the store.",
      409
    );
  }

  /*
   * Only allow access to orders owned by the authenticated customer.
   */
  const order = await Order.findOne({
    _id: input.orderId,
    user: validatedUserId,
  }).lean();

  if (!order) {
    throw createError("Order not found.", 404);
  }

  if (order.orderStatus !== "delivered") {
    throw createError(
      "An exchange can only be requested for a delivered order.",
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

  const exchangeDeadline = new Date(deliveredAt);

  exchangeDeadline.setDate(
    exchangeDeadline.getDate() + policy.windowDays
  );

  if (Date.now() > exchangeDeadline.getTime()) {
    throw createError(
      `The exchange window of ${policy.windowDays} days has expired.`,
      409
    );
  }

  /*
   * Verify that the selected order item exists in this order.
   */
  const orderItem = (order.items || []).find(
    (item) => String(item._id) === input.orderItemId
  );

  if (!orderItem) {
    throw createError(
      "The selected item was not found in this order.",
      404
    );
  }

  /*
   * Verify the replacement product and its selected variant.
   */
  const requestedDetails = await getRequestedProductDetails(
    input.requestedProductId,
    input.requestedVariantId
  );

  /*
   * Store the price difference on the request.
   *
   * Positive: replacement costs more.
   * Negative: replacement costs less.
   * Zero: no price difference.
   *
   * A non-zero difference starts as "pending". It must not be
   * marked paid/refunded until the corresponding payment action
   * has actually been completed and verified.
   */
  const originalLineTotal = Number(
    orderItem.lineTotal ??
    Number(orderItem.unitPrice) * orderItem.quantity
  );
  const originalUnitPrice =
    originalLineTotal / orderItem.quantity;

  if (
    !Number.isFinite(originalLineTotal) ||
    originalLineTotal < 0 ||
    !Number.isFinite(originalUnitPrice) ||
    originalUnitPrice < 0
  ) {
    throw createError(
      "The original order item has an invalid price.",
      409
    );
  }

  const priceDifference = roundMoney(
    (
      requestedDetails.requestedUnitPrice -
      originalUnitPrice
    ) * input.quantity
  );

  const priceDifferenceStatus =
    Math.abs(priceDifference) < 0.01
      ? "not_applicable"
      : "pending";

  const session = await mongoose.startSession();
  let exchangeRequest;

  try {
    await session.withTransaction(async () => {
      await reserveReturnExchangeQuantity({
        orderId: order._id,
        orderItemId: orderItem._id,
        purchasedQuantity: orderItem.quantity,
        quantity: input.quantity,
        session,
      });

      [exchangeRequest] = await ExchangeRequest.create(
        [
          {
            exchangeNumber: generateExchangeNumber(),

            order: order._id,
            orderItemId: orderItem._id,
            user: validatedUserId,

            originalProduct: orderItem.product,
            originalVariant: orderItem.variant ?? null,
            originalProductName: orderItem.productName,
            originalSku: orderItem.sku,

            quantity: input.quantity,

            requestedProduct: requestedDetails.product._id,
            requestedVariant: requestedDetails.variant?._id ?? null,
            requestedProductName: requestedDetails.product.name,
            requestedSku: requestedDetails.requestedSku,

            reason: input.reason,
            reasonDetails: input.reasonDetails,

            status: "requested",

            priceDifference,
            priceDifferenceStatus,

            requestedAt: new Date(),
          },
        ],
        { session }
      );
    });

    const result = exchangeRequest.toObject();
    await emitCustomerNotification({
      recipientId: validatedUserId,
      type: "exchange",
      title: "Exchange request received",
      message: `Your exchange request ${result.exchangeNumber} was submitted.`,
      relatedOrder: order._id,
      actionUrl: `/account/exchanges/${result._id}`,
      idempotencyKey: `exchange.requested:${result._id}`,
    });
    return result;
  } catch (error) {
    if (error.code === 11000) {
      throw createError(
        "A duplicate exchange request number was detected. Please retry.",
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
| 2. List Customer Exchange Requests
|--------------------------------------------------------------------------
|
| GET /api/v1/exchanges
|
*/

export const listCustomerExchangeRequests = async (
  userId,
  options = {}
) => {
  const validatedUserId = validateUserId(userId);

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

  const filter = {
    user: validatedUserId,
  };

  if (options.status) {
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
| 3. Get Customer Exchange Request By ID
|--------------------------------------------------------------------------
|
| GET /api/v1/exchanges/:exchangeRequestId
|
*/

export const getCustomerExchangeRequestById = async (
  userId,
  exchangeRequestId
) => {
  const validatedUserId = validateUserId(userId);

  const validatedExchangeRequestId = validateObjectId(
    exchangeRequestId,
    "exchange request ID"
  );

  const exchangeRequest = await ExchangeRequest.findOne({
    _id: validatedExchangeRequestId,
    user: validatedUserId,
  }).lean();

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
| 4. Cancel Customer Exchange Request
|--------------------------------------------------------------------------
|
| PATCH /api/v1/exchanges/:exchangeRequestId/cancel
|
| Customers may cancel a request only while it is requested
| or under review.
|
*/

export const cancelCustomerExchangeRequest = async (
  userId,
  exchangeRequestId
) => {
  const validatedUserId = validateUserId(userId);

  const validatedExchangeRequestId = validateObjectId(
    exchangeRequestId,
    "exchange request ID"
  );

  const cancellableStatuses = [
    "requested",
    "under_review",
  ];

  const session = await mongoose.startSession();
  let exchangeRequest;

  try {
    await session.withTransaction(async () => {
      exchangeRequest = await ExchangeRequest.findOneAndUpdate(
        {
          _id: validatedExchangeRequestId,
          user: validatedUserId,
          status: { $in: cancellableStatuses },
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
      ).lean();

      if (!exchangeRequest) {
        const existingRequest = await ExchangeRequest.findOne({
          _id: validatedExchangeRequestId,
          user: validatedUserId,
        })
          .select("_id status")
          .session(session)
          .lean();

        if (!existingRequest) {
          throw createError(
            "Exchange request not found.",
            404
          );
        }

        throw createError(
          "This exchange request can no longer be cancelled.",
          409
        );
      }

      await releaseReturnExchangeQuantity({
        orderId: exchangeRequest.order,
        orderItemId: exchangeRequest.orderItemId,
        quantity: exchangeRequest.quantity,
        session,
      });
    });

    return exchangeRequest;
  } finally {
    await session.endSession();
  }
};
