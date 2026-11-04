import Order from "../models/Order.js";
import Shipping from "../models/Shipping.js";
import { updateOrderStatus } from "./orderService.js";
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

const normalizeString = (
  value,
  fieldName,
  maxLength,
  { nullable = true } = {}
) => {
  if (value === undefined) {
    return undefined;
  }

  if (value === null || value === "") {
    if (nullable) {
      return null;
    }

    throw createError(`${fieldName} is required.`, 400);
  }

  if (typeof value !== "string") {
    throw createError(
      `${fieldName} must be a string.`,
      400
    );
  }

  const normalized = value.trim();

  if (!normalized && !nullable) {
    throw createError(`${fieldName} is required.`, 400);
  }

  if (normalized.length > maxLength) {
    throw createError(
      `${fieldName} cannot exceed ${maxLength} characters.`,
      400
    );
  }

  return normalized || null;
};

const normalizeUrl = (value) => {
  const normalized = normalizeString(
    value,
    "Tracking URL",
    2048
  );

  if (normalized === undefined || normalized === null) {
    return normalized;
  }

  let parsedUrl;

  try {
    parsedUrl = new URL(normalized);
  } catch {
    throw createError(
      "Tracking URL must be a valid URL.",
      400
    );
  }

  if (!["https:", "http:"].includes(parsedUrl.protocol)) {
    throw createError(
      "Tracking URL must use HTTP or HTTPS.",
      400
    );
  }

  return normalized;
};

const normalizeServiceType = (value) => {
  if (value === undefined) {
    return undefined;
  }

  const allowedTypes = [
    "standard",
    "express",
    "same_day",
    "other",
  ];

  if (!allowedTypes.includes(value)) {
    throw createError(
      `Service type must be one of: ${allowedTypes.join(", ")}.`,
      400
    );
  }

  return value;
};

const normalizeMoney = (value, fieldName) => {
  if (value === undefined) {
    return undefined;
  }

  const amount = Number(value);

  if (
    !Number.isFinite(amount) ||
    amount < 0 ||
    amount > 10000000
  ) {
    throw createError(
      `${fieldName} must be a valid non-negative amount.`,
      400
    );
  }

  return Math.round((amount + Number.EPSILON) * 100) / 100;
};

const normalizeDate = (value, fieldName) => {
  if (value === undefined) {
    return undefined;
  }

  if (value === null || value === "") {
    return null;
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    throw createError(
      `${fieldName} must be a valid date.`,
      400
    );
  }

  return date;
};

const parsePagination = ({
  page = 1,
  limit = 20,
} = {}) => {
  const parsedPage = Number(page);
  const parsedLimit = Number(limit);

  if (
    !Number.isInteger(parsedPage) ||
    parsedPage < 1
  ) {
    throw createError(
      "Page must be a positive integer.",
      400
    );
  }

  if (
    !Number.isInteger(parsedLimit) ||
    parsedLimit < 1 ||
    parsedLimit > 100
  ) {
    throw createError(
      "Limit must be an integer between 1 and 100.",
      400
    );
  }

  return {
    page: parsedPage,
    limit: parsedLimit,
  };
};

const populateOrderDetails = {
  path: "order",
  select:
    "orderNumber customerName customerEmail customerPhone orderStatus paymentStatus paymentMethod totalAmount currency createdAt",
};

/*
|--------------------------------------------------------------------------
| Tracking Number Validation
|--------------------------------------------------------------------------
*/

const ensureTrackingNumberAvailable = async (
  trackingNumber,
  excludeShippingId = null
) => {
  if (!trackingNumber) {
    return;
  }

  const filter = {
    trackingNumber,
  };

  if (excludeShippingId) {
    filter._id = {
      $ne: excludeShippingId,
    };
  }

  const existingShipping = await Shipping.exists(filter);

  if (existingShipping) {
    throw createError(
      "This tracking number is already assigned to another shipment.",
      409
    );
  }
};

/*
|--------------------------------------------------------------------------
| Shipment Input Helpers
|--------------------------------------------------------------------------
*/

const shipmentDetailFields = [
  "carrier",
  "serviceType",
  "trackingNumber",
  "trackingUrl",
  "shippingCost",
  "estimatedDeliveryAt",
  "deliveryNotes",
];

const parseShipmentDetails = (data) => {
  validateObject(data, shipmentDetailFields);

  const update = {};

  if (Object.hasOwn(data, "carrier")) {
    update.carrier = normalizeString(
      data.carrier,
      "Carrier",
      120
    );
  }

  if (Object.hasOwn(data, "serviceType")) {
    update.serviceType = normalizeServiceType(
      data.serviceType
    );
  }

  if (Object.hasOwn(data, "trackingNumber")) {
    update.trackingNumber = normalizeString(
      data.trackingNumber,
      "Tracking number",
      100
    );
  }

  if (Object.hasOwn(data, "trackingUrl")) {
    update.trackingUrl = normalizeUrl(
      data.trackingUrl
    );
  }

  if (Object.hasOwn(data, "shippingCost")) {
    update.shippingCost = normalizeMoney(
      data.shippingCost,
      "Shipping cost"
    );
  }

  if (Object.hasOwn(data, "estimatedDeliveryAt")) {
    update.estimatedDeliveryAt = normalizeDate(
      data.estimatedDeliveryAt,
      "Estimated delivery date"
    );
  }

  if (Object.hasOwn(data, "deliveryNotes")) {
    update.deliveryNotes = normalizeString(
      data.deliveryNotes,
      "Delivery notes",
      1000
    ) ?? "";
  }

  return update;
};

/*
|--------------------------------------------------------------------------
| 1. Create Shipment
|--------------------------------------------------------------------------
|
| POST /api/v1/admin/shipping
|
| Only processing orders are eligible.
| Razorpay orders must have successful payment.
| COD orders may have pending payment.
|
| Only one shipping record is allowed per order.
|--------------------------------------------------------------------------
*/

export const createShipment = async (
  adminId,
  orderId,
  data = {}
) => {
  const validatedAdminId = validateObjectId(
    String(adminId ?? ""),
    "admin ID"
  );

  const validatedOrderId = validateObjectId(
    String(orderId ?? ""),
    "order ID"
  );

  const details = parseShipmentDetails(data);

  const order = await Order.findById(
    validatedOrderId
  ).lean();

  if (!order) {
    throw createError("Order not found.", 404);
  }

  if (!["confirmed", "processing"].includes(order.orderStatus)) {
    throw createError(
      "A shipment can only be created for a confirmed or processing order.",
      409
    );
  }

  if (
    order.paymentMethod === "razorpay" &&
    order.paymentStatus !== "paid"
  ) {
    throw createError(
      "Razorpay payment must be successful before shipment creation.",
      409
    );
  }

  if (
    order.paymentMethod === "cod" &&
    !["pending", "paid"].includes(order.paymentStatus)
  ) {
    throw createError(
      "This COD order is not eligible for shipment.",
      409
    );
  }

  if (!order.shippingAddress) {
    throw createError(
      "The order does not have a shipping address.",
      409
    );
  }

  const existingShipment = await Shipping.exists({
    order: order._id,
  });

  if (existingShipment) {
    throw createError(
      "A shipment already exists for this order.",
      409
    );
  }

  await ensureTrackingNumberAvailable(
    details.trackingNumber
  );

  if (order.orderStatus === "confirmed") {
    await updateOrderStatus(validatedOrderId, "processing");
  }

  try {
    const shipment = await Shipping.create({
      order: order._id,

      carrier: details.carrier ?? null,
      serviceType: details.serviceType ?? "standard",
      trackingNumber: details.trackingNumber ?? undefined,
      trackingUrl: details.trackingUrl ?? null,

      status: "pending",

      // Copy the address snapshot from the order.
      // Do not accept a client-supplied shipping address.
      shippingAddress: order.shippingAddress,

      shippingCost:
        details.shippingCost ?? order.shippingAmount ?? 0,

      estimatedDeliveryAt:
        details.estimatedDeliveryAt ?? null,

      lastTrackingUpdateAt:
        details.trackingNumber || details.trackingUrl
          ? new Date()
          : null,

      deliveryNotes: details.deliveryNotes ?? "",

      createdBy: validatedAdminId,
    });

    return shipment.toObject();
  } catch (error) {
    if (error.code === 11000) {
      throw createError(
        "A shipment already exists for this order or the tracking number is duplicated.",
        409
      );
    }

    throw error;
  }
};

/*
|--------------------------------------------------------------------------
| 2. List Shipments For Admin
|--------------------------------------------------------------------------
|
| GET /api/v1/admin/shipping
|--------------------------------------------------------------------------
*/

export const listAdminShipments = async (
  options = {}
) => {
  const { page, limit } = parsePagination(options);

  const filter = {};

  const allowedStatuses = [
    "pending",
    "ready_to_ship",
    "shipped",
    "in_transit",
    "out_for_delivery",
    "delivered",
    "delivery_failed",
    "returned_to_sender",
    "cancelled",
  ];

  if (options.status) {
    if (!allowedStatuses.includes(options.status)) {
      throw createError(
        "Invalid shipment status filter.",
        400
      );
    }

    filter.status = options.status;
  }

  if (options.trackingNumber) {
    if (
      typeof options.trackingNumber !== "string" ||
      options.trackingNumber.trim().length > 100
    ) {
      throw createError(
        "Invalid tracking number filter.",
        400
      );
    }

    filter.trackingNumber = options.trackingNumber.trim();
  }

  const skip = (page - 1) * limit;

  const [shipments, total] = await Promise.all([
    Shipping.find(filter)
      .populate(populateOrderDetails)
      .sort({
        createdAt: -1,
        _id: -1,
      })
      .skip(skip)
      .limit(limit)
      .lean(),

    Shipping.countDocuments(filter),
  ]);

  return {
    shipments,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  };
};

export const listEligibleOrdersForShipping = async (
  options = {}
) => {
  const { page, limit } = parsePagination(options);
  const skip = (page - 1) * limit;
  const shipmentOrderIds = await Shipping.distinct("order");
  const filter = {
    orderStatus: { $in: ["confirmed", "processing"] },
    shippingAddress: { $exists: true, $ne: null },
    _id: { $nin: shipmentOrderIds },
    $or: [
      {
        paymentMethod: "razorpay",
        paymentStatus: "paid",
      },
      {
        paymentMethod: "cod",
        paymentStatus: { $in: ["pending", "paid"] },
      },
    ],
  };
  const [orders, total] = await Promise.all([
    Order.find(filter)
      .sort({ createdAt: -1, _id: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),
    Order.countDocuments(filter),
  ]);

  return {
    orders: orders || [],
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
| 3. Get One Shipment For Admin
|--------------------------------------------------------------------------
|
| GET /api/v1/admin/shipping/:shippingId
|--------------------------------------------------------------------------
*/

export const getAdminShipmentById = async (
  shippingId
) => {
  const validatedShippingId = validateObjectId(
    shippingId,
    "shipping ID"
  );

  const shipment = await Shipping.findById(
    validatedShippingId
  )
    .populate(populateOrderDetails)
    .lean();

  if (!shipment) {
    throw createError("Shipment not found.", 404);
  }

  return shipment;
};

/*
|--------------------------------------------------------------------------
| 4. Update Shipment Details
|--------------------------------------------------------------------------
|
| PATCH /api/v1/admin/shipping/:shippingId
|--------------------------------------------------------------------------
*/

export const updateShipmentDetails = async (
  shippingId,
  data
) => {
  const validatedShippingId = validateObjectId(
    shippingId,
    "shipping ID"
  );

  const update = parseShipmentDetails(data);

  const updateFields = Object.keys(update);

  if (updateFields.length === 0) {
    throw createError(
      "Provide at least one shipment field to update.",
      400
    );
  }

  const shipment = await Shipping.findById(
    validatedShippingId
  ).lean();

  if (!shipment) {
    throw createError("Shipment not found.", 404);
  }

  if (shipment.status === "cancelled") {
    throw createError(
      "Cancelled shipment details cannot be updated.",
      409
    );
  }

  if (Object.hasOwn(update, "trackingNumber")) {
    await ensureTrackingNumberAvailable(
      update.trackingNumber,
      validatedShippingId
    );
  }

  if (
    Object.hasOwn(update, "trackingNumber") ||
    Object.hasOwn(update, "trackingUrl")
  ) {
    update.lastTrackingUpdateAt = new Date();
  }

  try {
    const updatedShipment =
      await Shipping.findByIdAndUpdate(
        validatedShippingId,
        {
          $set: update,
        },
        {
          returnDocument: "after",
          runValidators: true,
        }
      );

    if (!updatedShipment) {
      throw createError(
        "Shipment not found.",
        404
      );
    }

    return updatedShipment.toObject();
  } catch (error) {
    if (error.code === 11000) {
      throw createError(
        "This tracking number is already assigned to another shipment.",
        409
      );
    }

    throw error;
  }
};

/*
|--------------------------------------------------------------------------
| 5. Update Shipment Status
|--------------------------------------------------------------------------
|
| PATCH /api/v1/admin/shipping/:shippingId/status
|
| Order status synchronisation:
|   Shipment shipped   -> Order shipped
|   Shipment delivered -> Order delivered
|
| The order is updated first with a conditional write.
| If the shipment write fails, the order update is rolled back.
|--------------------------------------------------------------------------
*/

const allowedShipmentTransitions = {
  pending: ["ready_to_ship", "cancelled"],

  ready_to_ship: ["shipped", "cancelled"],

  shipped: [
    "in_transit",
    "out_for_delivery",
    "delivery_failed",
    "returned_to_sender",
  ],

  in_transit: [
    "out_for_delivery",
    "delivery_failed",
    "returned_to_sender",
  ],

  out_for_delivery: [
    "delivered",
    "delivery_failed",
  ],

  delivery_failed: [
    "in_transit",
    "out_for_delivery",
    "returned_to_sender",
  ],

  delivered: [],
  returned_to_sender: [],
  cancelled: ["pending"],
};

export const updateShipmentStatus = async (
  shippingId,
  newStatus,
  data = {}
) => {
  const validatedShippingId = validateObjectId(
    shippingId,
    "shipping ID"
  );

  const allowedStatuses = Object.keys(
    allowedShipmentTransitions
  );

  if (!allowedStatuses.includes(newStatus)) {
    throw createError(
      "Invalid shipment status.",
      400
    );
  }

  const allowedFields = [
    "failureReason",
    "deliveryNotes",
  ];

  validateObject(data, allowedFields);

  const failureReason = normalizeString(
    data.failureReason,
    "Failure reason",
    500
  );

  const deliveryNotes = normalizeString(
    data.deliveryNotes,
    "Delivery notes",
    1000
  );

  if (
    failureReason &&
    newStatus !== "delivery_failed"
  ) {
    throw createError(
      "A failure reason can only be provided when the shipment status is delivery_failed.",
      400
    );
  }

  const shipment = await Shipping.findById(
    validatedShippingId
  ).lean();

  if (!shipment) {
    throw createError("Shipment not found.", 404);
  }

  if (shipment.status === newStatus) {
    return shipment;
  }

  const allowedNextStatuses =
    allowedShipmentTransitions[shipment.status] || [];

  if (!allowedNextStatuses.includes(newStatus)) {
    throw createError(
      `Shipment cannot transition from "${shipment.status}" to "${newStatus}".`,
      409
    );
  }

  const order = await Order.findById(
    shipment.order
  ).lean();

  if (!order) {
    throw createError(
      "The order associated with this shipment could not be found.",
      409
    );
  }

  const now = new Date();

  const shipmentUpdate = {
    status: newStatus,
    lastTrackingUpdateAt: now,
  };

  if (shipment.status === "cancelled" && newStatus === "pending") {
    Object.assign(shipmentUpdate, {
      carrier: null,
      serviceType: "standard",
      trackingUrl: null,
      estimatedDeliveryAt: null,
      shippedAt: null,
      deliveredAt: null,
      deliveryAttempts: 0,
      failureReason: null,
      deliveryNotes: "",
    });
  }

  if (newStatus === "shipped") {
    shipmentUpdate.shippedAt = now;
  }

  if (newStatus === "delivered") {
    shipmentUpdate.deliveredAt = now;
  }

  if (newStatus === "delivery_failed") {
    shipmentUpdate.failureReason =
      failureReason ?? shipment.failureReason ?? null;
  } else if (
    shipment.failureReason &&
    ["in_transit", "out_for_delivery"].includes(newStatus)
  ) {
    shipmentUpdate.failureReason = null;
  }

  if (deliveryNotes !== undefined) {
    shipmentUpdate.deliveryNotes = deliveryNotes ?? "";
  }

  /*
   * Count an attempt each time the shipment enters
   * out_for_delivery, including a retry after failure.
   */
  const shipmentOperations = {
    $set: shipmentUpdate,
  };

  if (shipment.status === "cancelled" && newStatus === "pending") {
    shipmentOperations.$unset = { trackingNumber: 1 };
  }

  if (newStatus === "out_for_delivery") {
    shipmentOperations.$inc = {
      deliveryAttempts: 1,
    };
  }

  /*
   * Synchronise Order state before saving the Shipment.
   */
  let changedOrder = null;

  if (newStatus === "shipped") {
    if (order.orderStatus === "processing") {
      const updatedOrder = await Order.findOneAndUpdate(
        {
          _id: order._id,
          orderStatus: "processing",
        },
        {
          $set: {
            orderStatus: "shipped",
            shippedAt: now,
          },
        },
        {
          returnDocument: "after",
          runValidators: true,
        }
      );

      if (!updatedOrder) {
        throw createError(
          "The order changed while shipping was being processed. Refresh and retry.",
          409
        );
      }

      changedOrder = {
        previousStatus: "processing",
        nextStatus: "shipped",
        timestampField: "shippedAt",
        previousTimestamp: order.shippedAt ?? null,
        timestamp: now,
      };
    } else if (order.orderStatus !== "shipped") {
      throw createError(
        "The order must be processing before the shipment can be marked as shipped.",
        409
      );
    }
  }

  if (newStatus === "delivered") {
    if (order.orderStatus === "shipped") {
      const updatedOrder = await Order.findOneAndUpdate(
        {
          _id: order._id,
          orderStatus: "shipped",
        },
        {
          $set: {
            orderStatus: "delivered",
            deliveredAt: now,
          },
        },
        {
          returnDocument: "after",
          runValidators: true,
        }
      );

      if (!updatedOrder) {
        throw createError(
          "The order changed while delivery was being processed. Refresh and retry.",
          409
        );
      }

      changedOrder = {
        previousStatus: "shipped",
        nextStatus: "delivered",
        timestampField: "deliveredAt",
        previousTimestamp: order.deliveredAt ?? null,
        timestamp: now,
      };
    } else if (order.orderStatus !== "delivered") {
      throw createError(
        "The order must be shipped before the shipment can be marked as delivered.",
        409
      );
    }
  }

  try {
    const updatedShipment =
      await Shipping.findOneAndUpdate(
        {
          _id: validatedShippingId,
          status: shipment.status,
        },
        shipmentOperations,
        {
          returnDocument: "after",
          runValidators: true,
        }
      );

    if (!updatedShipment) {
      throw createError(
        "The shipment was changed by another request. Refresh and retry.",
        409
      );
    }

    const notificationCopy = {
      pending: ["Shipment reopened", "Your shipment is being prepared again."],
      shipped: ["Order shipped", "Your order is on its way."],
      in_transit: ["Shipment in transit", "Your shipment is moving through the delivery network."],
      out_for_delivery: ["Out for delivery", "Your shipment is out for delivery."],
      delivered: ["Order delivered", "Your order has been delivered."],
      delivery_failed: ["Delivery attempt failed", "The carrier could not deliver your order. Please check the tracking details."],
      returned_to_sender: ["Shipment returned", "Your shipment is being returned to the sender."],
      cancelled: ["Shipment cancelled", "The shipment for your order has been cancelled."],
    }[newStatus];

    if (notificationCopy && order.user) {
      await emitCustomerNotification({
        recipientId: order.user,
        type: "shipping",
        title: notificationCopy[0],
        message: `${notificationCopy[1]} Order ${order.orderNumber}.`,
        relatedOrder: order._id,
        actionUrl: `/orders/${order._id}`,
        idempotencyKey: `shipping.status:${updatedShipment._id}:${newStatus}`,
      });
    }

    return updatedShipment.toObject();
  } catch (error) {
    /*
     * If the order changed but the shipment did not,
     * try to restore the previous order status.
     */
    if (changedOrder) {
      const rollbackFilter = {
        _id: order._id,
        orderStatus: changedOrder.nextStatus,
        [changedOrder.timestampField]:
          changedOrder.timestamp,
      };

      const rollbackResult = await Order.updateOne(
        rollbackFilter,
        {
          $set: {
            orderStatus: changedOrder.previousStatus,
            [changedOrder.timestampField]:
              changedOrder.previousTimestamp,
          },
        }
      );

      if (rollbackResult.modifiedCount !== 1) {
        throw createError(
          "Shipment update failed and order rollback was incomplete. Please review the order and shipment records.",
          500
        );
      }
    }

    throw error;
  }
};

/*
|--------------------------------------------------------------------------
| 6. Customer Shipment Tracking
|--------------------------------------------------------------------------
|
| GET /api/v1/orders/:orderId/shipment
|
| A customer can access only their own order.
|--------------------------------------------------------------------------
*/

export const getCustomerShipmentByOrderId = async (
  userId,
  orderId
) => {
  const validatedUserId = validateObjectId(
    String(userId ?? ""),
    "customer ID"
  );

  const validatedOrderId = validateObjectId(
    orderId,
    "order ID"
  );

  const order = await Order.findOne({
    _id: validatedOrderId,
    user: validatedUserId,
  })
    .select(
      "_id orderNumber orderStatus paymentStatus shippingAddress createdAt shippedAt deliveredAt"
    )
    .lean();

  if (!order) {
    throw createError("Order not found.", 404);
  }

  const shipment = await Shipping.findOne({
    order: order._id,
  }).lean();

  return {
    order: {
      _id: order._id,
      orderNumber: order.orderNumber,
      orderStatus: order.orderStatus,
      paymentStatus: order.paymentStatus,
      shippingAddress: order.shippingAddress,
      createdAt: order.createdAt,
      shippedAt: order.shippedAt,
      deliveredAt: order.deliveredAt,
    },

    // A shipment may not exist yet for a new order.
    shipment,
  };
};