import { randomBytes } from "node:crypto";

import Order from "../models/Order.js";
import User from "../models/User.js";
import Cart from "../models/Cart.js";
import Address from "../models/Address.js";
import Product from "../models/Product.js";
import ProductVariant from "../models/ProductVariant.js";
import Inventory from "../models/Inventory.js";
import {
  getCouponForOrder,
  recordCouponRedemption,
  redeemCouponForOrder,
  releaseCouponRedemptionForOrder,
  releaseCouponReservation,
  reserveCouponUsage,
} from "./couponService.js";
import { emitCustomerNotification } from "./notificationService.js";
import { assertCodEligible } from "./businessPolicy.js";

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
  return validateObjectId(userId, "customer ID");
};

const roundMoney = (value) => {
  return Math.round(
    (value + Number.EPSILON) * 100
  ) / 100;
};

const validateQuantity = (value) => {
  const quantity = Number(value);

  if (
    !Number.isInteger(quantity) ||
    quantity < 1 ||
    quantity > 20
  ) {
    throw createError(
      "Order quantity must be a whole number between 1 and 20.",
      400
    );
  }

  return quantity;
};

const handleOrderError = (error) => {
  if (error.statusCode) {
    throw error;
  }

  if (error.code === 11000) {
    throw createError(
      "A duplicate order number was generated. Please retry.",
      409
    );
  }

  if (
    error.name === "ValidationError" ||
    error.name === "CastError"
  ) {
    throw createError(
      error.message,
      400
    );
  }

  throw error;
};

/*
|--------------------------------------------------------------------------
| Order Number
|--------------------------------------------------------------------------
*/

const generateOrderNumber = () => {
  const date = new Date()
    .toISOString()
    .slice(0, 10)
    .replace(/-/g, "");

  const uniquePart = randomBytes(4)
    .toString("hex")
    .toUpperCase();

  return `NIA-${date}-${uniquePart}`;
};

/*
|--------------------------------------------------------------------------
| Address Snapshot
|--------------------------------------------------------------------------
|
| Order addresses are stored as snapshots.
| Later edits to a customer's saved address will not modify
| an already-created order.
|--------------------------------------------------------------------------
*/

const createAddressSnapshot = (address) => {
  return {
    fullName: address.fullName,
    phone: address.phone,
    addressLine1: address.addressLine1,
    addressLine2: address.addressLine2 || "",
    landmark: address.landmark || "",
    city: address.city,
    state: address.state,
    postalCode: address.postalCode,
    country: address.country || "India",
  };
};

/*
|--------------------------------------------------------------------------
| Request Validation
|--------------------------------------------------------------------------
*/

const validateCreateOrderInput = (data) => {
  if (
    !data ||
    typeof data !== "object" ||
    Array.isArray(data)
  ) {
    throw createError(
      "Order data must be a valid object.",
      400
    );
  }

  const allowedFields = new Set([
    "shippingAddressId",
    "billingAddressId",
    "paymentMethod",
    "notes",
    "couponCode",
    "policiesAccepted",
  ]);

  const unknownFields = Object.keys(data).filter(
    (key) => !allowedFields.has(key)
  );

  if (unknownFields.length > 0) {
    throw createError(
      `Unsupported order field(s): ${unknownFields.join(", ")}.`,
      400
    );
  }

  validateObjectId(
    data.shippingAddressId,
    "shipping address ID"
  );

  if (
    data.billingAddressId !== undefined &&
    data.billingAddressId !== null &&
    data.billingAddressId !== ""
  ) {
    validateObjectId(
      data.billingAddressId,
      "billing address ID"
    );
  }

  if (
    !["razorpay", "cod"].includes(
      data.paymentMethod
    )
  ) {
    throw createError(
      "Payment method must be razorpay or cod.",
      400
    );
  }

  if (data.policiesAccepted !== true) {
    throw createError("Please review and accept the store policies before placing your order.", 400);
  }

  if (
    data.notes !== undefined &&
    (
      typeof data.notes !== "string" ||
      data.notes.length > 1000
    )
  ) {
    throw createError(
      "Order notes must be a string of at most 1000 characters.",
      400
    );
  }

  if (
    data.couponCode !== undefined &&
    (
      typeof data.couponCode !== "string" ||
      data.couponCode.trim().length < 3 ||
      data.couponCode.trim().length > 50
    )
  ) {
    throw createError(
      "Coupon code must contain between 3 and 50 characters.",
      400
    );
  }
};

/*
|--------------------------------------------------------------------------
| Active Customer
|--------------------------------------------------------------------------
*/

const getActiveCustomer = async (userId) => {
  const user = await User.findById(userId)
    .select("name email phone status")
    .lean();

  if (!user) {
    throw createError(
      "Customer not found.",
      404
    );
  }

  if (user.status !== "active") {
    throw createError(
      "Your account cannot place orders.",
      403
    );
  }

  return user;
};

/*
|--------------------------------------------------------------------------
| Customer-Owned Address
|--------------------------------------------------------------------------
*/

const getCustomerAddress = async (
  userId,
  addressId,
  fieldName
) => {
  const address = await Address.findOne({
    _id: addressId,
    user: userId,
  }).lean();

  if (!address) {
    throw createError(
      `${fieldName} not found.`,
      404
    );
  }

  return address;
};

/*
|--------------------------------------------------------------------------
| Product And Variant Validation
|--------------------------------------------------------------------------
*/

const getActiveProduct = async (productId) => {
  if (!productId) {
    throw createError(
      "A cart item has an invalid product reference.",
      400
    );
  }

  const product = await Product.findOne({
    _id: productId,
    status: "active",
  })
    .select(
      "_id name slug sku status category basePrice salePrice currency primaryImage"
    )
    .populate(
      "category",
      "name slug isActive"
    )
    .lean();

  if (
    !product ||
    !product.category ||
    !product.category.isActive
  ) {
    throw createError(
      "A cart product is no longer available.",
      409
    );
  }

  if (
    product.currency &&
    product.currency !== "INR"
  ) {
    throw createError(
      "Only INR products can currently be ordered.",
      409
    );
  }

  return product;
};

const getValidatedVariant = async (
  productId,
  variantId
) => {
  if (!variantId) {
    const hasActiveVariants =
      await ProductVariant.exists({
        product: productId,
        isActive: true,
      });

    if (hasActiveVariants) {
      throw createError(
        "Please select an active variant for each product that has variants.",
        409
      );
    }

    return null;
  }

  const variant = await ProductVariant.findOne({
    _id: variantId,
    product: productId,
    isActive: true,
  })
    .select(
      "_id product sku name color colorCode blouseOption priceAdjustment image isActive"
    )
    .lean();

  if (!variant) {
    throw createError(
      "A selected product variant is no longer available.",
      409
    );
  }

  return variant;
};

/*
|--------------------------------------------------------------------------
| Inventory Record Lookup
|--------------------------------------------------------------------------
*/

const getInventoryForItem = async (
  productId,
  variantId
) => {
  const filter = variantId
    ? {
        product: productId,
        variant: variantId,
        inventoryType: "variant",
      }
    : {
        product: productId,
        inventoryType: "product",
      };

  const inventory = await Inventory.findOne(filter)
    .select("_id product variant inventoryType quantity reservedQuantity")
    .lean();

  if (!inventory) {
    throw createError(
      "Inventory is not configured for a product in your cart.",
      409
    );
  }

  return inventory;
};

/*
|--------------------------------------------------------------------------
| Inventory Requirement Aggregation
|--------------------------------------------------------------------------
|
| Group by inventory record in case a cart contains duplicated
| product/variant lines.
|--------------------------------------------------------------------------
*/

const addInventoryRequirement = (
  requirementMap,
  inventory,
  quantity
) => {
  const inventoryId = String(inventory._id);

  if (requirementMap.has(inventoryId)) {
    requirementMap.get(inventoryId).quantity += quantity;
  } else {
    requirementMap.set(inventoryId, {
      inventoryId,
      quantity,
    });
  }
};

/*
|--------------------------------------------------------------------------
| Reserve Stock
|--------------------------------------------------------------------------
|
| Reservation is atomic for each inventory record.
| A reservation succeeds only when available stock is sufficient.
|--------------------------------------------------------------------------
*/

const reserveInventory = async (requirements) => {
  const reserved = [];

  try {
    for (const requirement of requirements) {
      const result = await Inventory.updateOne(
        {
          _id: requirement.inventoryId,
          $expr: {
            $gte: [
              {
                $subtract: [
                  "$quantity",
                  "$reservedQuantity",
                ],
              },
              requirement.quantity,
            ],
          },
        },
        {
          $inc: {
            reservedQuantity: requirement.quantity,
          },
        }
      );

      if (result.modifiedCount !== 1) {
        throw createError(
          "Insufficient available stock for one or more order items.",
          409
        );
      }

      reserved.push(requirement);
    }

    return reserved;
  } catch (error) {
    /*
     * Compensate earlier reservations if a later item
     * cannot be reserved.
     */
    try {
      await releaseInventoryReservations(reserved);
    } catch (rollbackError) {
      throw createError(
        "Stock reservation failed and automatic rollback was incomplete. Inventory requires review.",
        500
      );
    }

    throw error;
  }
};

/*
|--------------------------------------------------------------------------
| Release Reservations
|--------------------------------------------------------------------------
|
| Used when an unpaid/unprocessed order is cancelled or when
| order creation fails after stock was reserved.
|--------------------------------------------------------------------------
*/

const releaseInventoryReservations = async (
  requirements
) => {
  const released = [];

  try {
    for (const requirement of [...requirements].reverse()) {
      const result = await Inventory.updateOne(
        {
          _id: requirement.inventoryId,
          reservedQuantity: {
            $gte: requirement.quantity,
          },
        },
        {
          $inc: {
            reservedQuantity: -requirement.quantity,
          },
        }
      );

      if (result.modifiedCount !== 1) {
        throw createError(
          "Unable to release a stock reservation. Inventory requires review.",
          500
        );
      }

      released.push(requirement);
    }
  } catch (error) {
    // Attempt to restore any releases already performed.
    for (const requirement of released) {
      await Inventory.updateOne(
        {
          _id: requirement.inventoryId,
        },
        {
          $inc: {
            reservedQuantity: requirement.quantity,
          },
        }
      );
    }

    throw error;
  }
};

/*
|--------------------------------------------------------------------------
| Inventory Requirements For An Existing Order
|--------------------------------------------------------------------------
*/

const getOrderInventoryRequirements = async (order) => {
  const requirementMap = new Map();

  for (const item of order.items) {
    if (!item.product) {
      throw createError(
        "An order item is missing its product reference.",
        409
      );
    }

    const inventory = await getInventoryForItem(
      String(item.product),
      item.variant
        ? String(item.variant)
        : null
    );

    addInventoryRequirement(
      requirementMap,
      inventory,
      item.quantity
    );
  }

  return [...requirementMap.values()];
};

/*
|--------------------------------------------------------------------------
| Commit Reserved Stock
|--------------------------------------------------------------------------
|
| When an order moves into processing:
|   quantity decreases;
|   reservedQuantity decreases.
|
| Available quantity remains consistent:
| quantity - reservedQuantity.
|--------------------------------------------------------------------------
*/

const commitReservedInventory = async (
  requirements
) => {
  const committed = [];

  try {
    for (const requirement of requirements) {
      const result = await Inventory.updateOne(
        {
          _id: requirement.inventoryId,
          quantity: {
            $gte: requirement.quantity,
          },
          reservedQuantity: {
            $gte: requirement.quantity,
          },
        },
        {
          $inc: {
            quantity: -requirement.quantity,
            reservedQuantity: -requirement.quantity,
          },
        }
      );

      if (result.modifiedCount !== 1) {
        throw createError(
          "Reserved stock could not be committed. Inventory requires review.",
          409
        );
      }

      committed.push(requirement);
    }
  } catch (error) {
    // Restore earlier commits if a later commit fails.
    for (const requirement of committed) {
      await Inventory.updateOne(
        {
          _id: requirement.inventoryId,
        },
        {
          $inc: {
            quantity: requirement.quantity,
            reservedQuantity: requirement.quantity,
          },
        }
      );
    }

    throw error;
  }
};

/*
|--------------------------------------------------------------------------
| 1. Create Order From Customer Cart
|--------------------------------------------------------------------------
|
| Client may provide:
|   shippingAddressId
|   optional billingAddressId
|   paymentMethod
|   optional notes
|
| Product prices and quantities are calculated/validated on
| the server. Client-supplied totals are not accepted.
|--------------------------------------------------------------------------
*/

export const createOrder = async (
  userId,
  data
) => {
  const validatedUserId =
    validateUserId(userId);

  validateCreateOrderInput(data);

  let reservedRequirements = [];
  let createdOrder = null;
  let couponReservation = null;
  let couponRedemptionRecorded = false;

  try {
    const user = await getActiveCustomer(
      validatedUserId
    );

    const shippingAddress =
      await getCustomerAddress(
        validatedUserId,
        data.shippingAddressId,
        "Shipping address"
      );

    let billingAddress = null;

    if (data.billingAddressId) {
      billingAddress =
        await getCustomerAddress(
          validatedUserId,
          data.billingAddressId,
          "Billing address"
        );
    }

    const cart = await Cart.findOne({
      user: validatedUserId,
    }).lean();

    if (!cart || !cart.items || cart.items.length === 0) {
      throw createError(
        "Your cart is empty.",
        400
      );
    }

    const orderItems = [];
    const couponItems = [];
    const requirementMap = new Map();

    let subtotal = 0;

    for (const cartItem of cart.items) {
      const quantity = validateQuantity(
        cartItem.quantity
      );

      const product = await getActiveProduct(
        cartItem.product
          ? String(cartItem.product)
          : null
      );

      const variant = await getValidatedVariant(
        String(product._id),
        cartItem.variant
          ? String(cartItem.variant)
          : null
      );

      const inventory = await getInventoryForItem(
        String(product._id),
        variant?._id
          ? String(variant._id)
          : null
      );

      addInventoryRequirement(
        requirementMap,
        inventory,
        quantity
      );

      const basePrice = Number(
        product.salePrice ?? product.basePrice
      );

      const priceAdjustment = Number(
        variant?.priceAdjustment ?? 0
      );

      const unitPrice = roundMoney(
        basePrice + priceAdjustment
      );

      if (
        !Number.isFinite(unitPrice) ||
        unitPrice < 0
      ) {
        throw createError(
          "An order item has an invalid price.",
          409
        );
      }

      const lineTotal = roundMoney(
        unitPrice * quantity
      );

      subtotal = roundMoney(
        subtotal + lineTotal
      );

      const variantDescription = variant
        ? [
            variant.name,
            variant.color,
            variant.blouseOption,
          ]
            .filter(Boolean)
            .join(" - ")
        : "";

      orderItems.push({
        product: product._id,
        variant: variant?._id ?? null,

        productName: product.name,
        categoryName: product.category?.name || "",
        sku: variant?.sku || product.sku,

        image:
          variant?.image?.url ||
          product.primaryImage?.url ||
          "",

        variantName: variantDescription,

        quantity,
        unitPrice,
        discountAmount: 0,
        lineTotal,
      });

      couponItems.push({
        product: product._id,
        category: product.category._id,
        lineTotal,
      });
    }

    let couponDiscount = null;
    if (data.couponCode) {
      couponDiscount = await getCouponForOrder(
        validatedUserId,
        data.couponCode,
        couponItems,
        subtotal
      );

      orderItems.forEach((item, index) => {
        const itemDiscount = couponDiscount.itemDiscounts[index] ?? 0;
        item.discountAmount = itemDiscount;
        item.lineTotal = roundMoney(
          item.lineTotal - itemDiscount
        );
      });
    }

    const totalAmount = couponDiscount?.totalAmount ?? subtotal;
    if (data.paymentMethod === "cod") assertCodEligible(totalAmount);

    const inventoryRequirements = [
      ...requirementMap.values(),
    ];

    reservedRequirements =
      await reserveInventory(
        inventoryRequirements
      );

    if (couponDiscount) {
      couponReservation = await reserveCouponUsage(
        couponDiscount.coupon,
        validatedUserId
      );
    }

    const shippingSnapshot =
      createAddressSnapshot(shippingAddress);

    const billingSnapshot = billingAddress
      ? createAddressSnapshot(billingAddress)
      : undefined;

    const notes =
      typeof data.notes === "string"
        ? data.notes.trim()
        : "";

    /*
     * COD orders are confirmed immediately.
     * Razorpay orders wait for payment confirmation.
     *
     * Stock remains reserved until the order advances
     * into processing.
     */
    const isCashOnDelivery =
      data.paymentMethod === "cod";

    const orderData = {
      orderNumber: generateOrderNumber(),
      user: validatedUserId,

      customerName: user.name,
      customerEmail: user.email,
      customerPhone:
        user.phone || shippingAddress.phone,

      items: orderItems,

      shippingAddress: shippingSnapshot,
      ...(billingSnapshot
        ? { billingAddress: billingSnapshot }
        : {}),

      subtotal,
      discountAmount: couponDiscount?.discountAmount ?? 0,
      taxAmount: 0,
      shippingAmount: 0,
      totalAmount,
      currency: "INR",
      coupon: couponDiscount?.coupon._id ?? null,
      couponCode: couponDiscount?.coupon.code ?? null,

      paymentMethod: data.paymentMethod,
      paymentStatus: "pending",
      policiesAcceptedAt: new Date(),
      acceptedPolicyVersion: "nishree-store-policies-2026-10-19",

      orderStatus: isCashOnDelivery
        ? "confirmed"
        : "pending_payment",

      confirmedAt: isCashOnDelivery
        ? new Date()
        : null,

      notes,
    };

    createdOrder = await Order.create(orderData);

    if (couponReservation && couponDiscount) {
      await recordCouponRedemption({
        reservation: couponReservation,
        orderId: createdOrder._id,
        discountAmount: couponDiscount.discountAmount,
        redeemed: isCashOnDelivery,
      });
      couponRedemptionRecorded = true;
    }

    /*
     * Clear the cart only if it has not changed since it
     * was read. If the cart changed concurrently, rollback
     * the new order and reservations.
     */
    const cartClearResult = await Cart.updateOne(
      {
        _id: cart._id,
        user: validatedUserId,
        updatedAt: cart.updatedAt,
      },
      {
        $set: {
          items: [],
          lastActivityAt: new Date(),
        },
      }
    );

    if (cartClearResult.matchedCount !== 1) {
      throw createError(
        "Your cart changed while the order was being created. Please review your cart and try again.",
        409
      );
    }

    await emitCustomerNotification({
      recipientId: validatedUserId,
      type: "order",
      title: "Order placed",
      message: `Your order ${createdOrder.orderNumber} has been placed.`,
      relatedOrder: createdOrder._id,
      actionUrl: `/orders/${createdOrder._id}`,
      idempotencyKey: `order.created:${createdOrder._id}`,
    });

    return createdOrder.toObject();
  } catch (error) {
    /*
     * If order creation or cart clearing fails, attempt to
     * remove the order and release its reservations.
     */
    let cleanupError = null;

    if (createdOrder) {
      try {
        await Order.deleteOne({
          _id: createdOrder._id,
          user: validatedUserId,
        });
      } catch (rollbackError) {
        cleanupError = rollbackError;
      }
    }

    if (couponReservation) {
      try {
        if (couponRedemptionRecorded && createdOrder) {
          await releaseCouponRedemptionForOrder(createdOrder._id);
        } else {
          await releaseCouponReservation(couponReservation);
        }
      } catch (rollbackError) {
        cleanupError = cleanupError || rollbackError;
      }
    }

    if (reservedRequirements.length > 0) {
      try {
        await releaseInventoryReservations(
          reservedRequirements
        );
      } catch (rollbackError) {
        cleanupError = cleanupError || rollbackError;
      }
    }

    if (cleanupError) {
      throw createError(
        `Order creation failed (${error.message}) and rollback was incomplete (${cleanupError.message}). Inventory or coupon usage requires reconciliation.`,
        500
      );
    }

    handleOrderError(error);
  }
};

/*
|--------------------------------------------------------------------------
| Pagination Helpers
|--------------------------------------------------------------------------
*/

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

/*
|--------------------------------------------------------------------------
| 2. List Customer Orders
|--------------------------------------------------------------------------
*/

export const listCustomerOrders = async (
  userId,
  options = {}
) => {
  const validatedUserId =
    validateUserId(userId);

  const { page, limit } =
    parsePagination(options);

  const filter = {
    user: validatedUserId,
  };

  if (options.status !== undefined && options.status !== "") {
const allowedStatuses = [
      "pending_payment",
      "confirmed",
      "processing",
      "shipped",
      "delivered",
      "cancelled",
      "return_requested",
  "returned",
];

const openAdminOrderStatuses = ["pending_payment", "confirmed", "processing"];

    if (!allowedStatuses.includes(options.status)) {
      throw createError(
        "Invalid order status filter.",
        400
      );
    }

    filter.orderStatus = options.status;
  }

  const skip = (page - 1) * limit;

  const [orders, total] = await Promise.all([
    Order.find(filter)
      .sort({
        createdAt: -1,
        _id: -1,
      })
      .skip(skip)
      .limit(limit)
      .lean(),

    Order.countDocuments(filter),
  ]);

  return {
    orders,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  };
};

export const getCustomerOrderSummary = async (userId) => {
  const validatedUserId = validateUserId(userId);
  const [total, active, delivered] = await Promise.all([
    Order.countDocuments({ user: validatedUserId }),
    Order.countDocuments({
      user: validatedUserId,
      orderStatus: {
        $in: ["pending_payment", "confirmed", "processing", "shipped"],
      },
    }),
    Order.countDocuments({
      user: validatedUserId,
      orderStatus: "delivered",
    }),
  ]);
  return { total, active, delivered };
};

/*
|--------------------------------------------------------------------------
| 3. Get One Customer Order
|--------------------------------------------------------------------------
*/

export const getCustomerOrderById = async (
  userId,
  orderId
) => {
  const validatedUserId =
    validateUserId(userId);

  const validatedOrderId =
    validateObjectId(
      orderId,
      "order ID"
    );

  const order = await Order.findOne({
    _id: validatedOrderId,
    user: validatedUserId,
  }).lean();

  if (!order) {
    throw createError(
      "Order not found.",
      404
    );
  }

  const missingCategoryProductIds = order.items
    .filter((item) => !item.categoryName && item.product)
    .map((item) => item.product);
  const productCategories = missingCategoryProductIds.length
    ? await Product.find({ _id: { $in: missingCategoryProductIds } })
      .select("_id category")
      .populate("category", "name")
      .lean()
    : [];
  const categoryByProduct = new Map(
    productCategories.map((product) => [String(product._id), product.category?.name || ""])
  );

  return {
    ...order,
    items: order.items.map((item) => ({
      ...item,
      categoryName: item.categoryName || categoryByProduct.get(String(item.product)) || "",
    })),
  };
};

/*
|--------------------------------------------------------------------------
| Order Status Transition
|--------------------------------------------------------------------------
*/

const allowedTransitions = {
  pending_payment: [
    "confirmed",
    "cancelled",
  ],
  confirmed: [
    "processing",
    "cancelled",
  ],
  processing: [
    "shipped",
  ],
  shipped: [
    "delivered",
  ],
  delivered: [],
  cancelled: [],
  return_requested: [],
  returned: [],
};

const isPaymentRefundedOrPaid = (order) => {
  return [
    "authorized",
    "paid",
    "partially_refunded",
    "refunded",
  ].includes(order.paymentStatus);
};

const buildStatusUpdate = (status) => {
  const update = {
    orderStatus: status,
  };

  const now = new Date();

  if (status === "confirmed") {
    update.confirmedAt = now;
  }

  if (status === "shipped") {
    update.shippedAt = now;
  }

  if (status === "delivered") {
    update.deliveredAt = now;
  }

  if (status === "cancelled") {
    update.cancelledAt = now;
  }

  return {
    update,
    timestamp: now,
  };
};

/*
|--------------------------------------------------------------------------
| 4. Transition Order Status
|--------------------------------------------------------------------------
|
| Processing commits previously reserved inventory.
| Cancelling an eligible order releases its reservations.
|
|--------------------------------------------------------------------------
*/

const transitionOrderStatus = async (
  order,
  newStatus
) => {
  if (
    !Object.prototype.hasOwnProperty.call(
      allowedTransitions,
      newStatus
    )
  ) {
    throw createError(
      "Invalid order status.",
      400
    );
  }

  if (order.orderStatus === newStatus) {
    return order;
  }

  if (["shipped", "delivered"].includes(newStatus)) {
    throw createError(
      "Update delivery progress through the Shipping workflow so the tracking record and order status stay synchronized.",
      409
    );
  }

  const allowedNextStatuses =
    allowedTransitions[order.orderStatus] || [];

  if (!allowedNextStatuses.includes(newStatus)) {
    throw createError(
      `Order cannot transition from "${order.orderStatus}" to "${newStatus}".`,
      409
    );
  }

  if (
    newStatus === "confirmed" &&
    order.paymentMethod === "razorpay" &&
    !["paid", "authorized"].includes(
      order.paymentStatus
    )
  ) {
    throw createError(
      "A Razorpay order cannot be confirmed before payment authorization or success.",
      409
    );
  }

  if (
    newStatus === "cancelled" &&
    isPaymentRefundedOrPaid(order)
  ) {
    throw createError(
      "This order has a payment authorization or payment record. Use the appropriate payment/refund workflow before cancelling it.",
      409
    );
  }

  const previousStatus = order.orderStatus;

  const { update, timestamp } =
    buildStatusUpdate(newStatus);

  /*
   * Claim the transition with a conditional update so a
   * concurrent status request cannot perform the same
   * transition using stale order state.
   */
  const updatedOrder = await Order.findOneAndUpdate(
    {
      _id: order._id,
      orderStatus: previousStatus,
    },
    {
      $set: update,
    },
    {
      returnDocument: "after",
      runValidators: true,
    }
  );

  if (!updatedOrder) {
    throw createError(
      "The order was updated by another request. Please refresh and retry.",
      409
    );
  }

  let releasedInventoryRequirements = null;

  try {
    if (newStatus === "processing") {
      const requirements =
        await getOrderInventoryRequirements(order);

      await commitReservedInventory(requirements);
    }

    if (newStatus === "confirmed") {
      await redeemCouponForOrder(order._id);
    }

    if (newStatus === "cancelled") {
      const requirements =
        await getOrderInventoryRequirements(order);

      await releaseInventoryReservations(requirements);
      releasedInventoryRequirements = requirements;
      await releaseCouponRedemptionForOrder(order._id);
    }

    const orderStatusNotification = {
      confirmed: [
        "Order confirmed",
        `Your order ${order.orderNumber} has been confirmed.`,
      ],
      processing: [
        "Order being prepared",
        `Your order ${order.orderNumber} is being prepared.`,
      ],
    }[newStatus];

    if (orderStatusNotification) {
      await emitCustomerNotification({
        recipientId: order.user,
        type: "order",
        title: orderStatusNotification[0],
        message: orderStatusNotification[1],
        relatedOrder: order._id,
        actionUrl: `/orders/${order._id}`,
        idempotencyKey: `order.status:${order._id}:${newStatus}`,
      });
    } else if (newStatus === "cancelled") {
      await emitCustomerNotification({
        recipientId: order.user,
        type: "order",
        title: "Order cancelled",
        message: `Your order ${order.orderNumber} has been cancelled.`,
        relatedOrder: order._id,
        actionUrl: `/orders/${order._id}`,
        idempotencyKey: `order.cancelled:${order._id}`,
      });
    }

    return updatedOrder.toObject();
  } catch (error) {
    /*
     * Restore the prior order state if the inventory
     * operation failed. Inventory helpers attempt their
     * own compensating updates.
     */
    const rollbackFields = {
      orderStatus: previousStatus,
      confirmedAt: order.confirmedAt ?? null,
      shippedAt: order.shippedAt ?? null,
      deliveredAt: order.deliveredAt ?? null,
      cancelledAt: order.cancelledAt ?? null,
    };

    await Order.updateOne(
      {
        _id: order._id,
        orderStatus: newStatus,
        ...(newStatus === "cancelled"
          ? { cancelledAt: timestamp }
          : {}),
      },
      {
        $set: rollbackFields,
      }
    );

    if (releasedInventoryRequirements) {
      try {
        await reserveInventory(releasedInventoryRequirements);
      } catch (inventoryRollbackError) {
        throw createError(
          `Order transition failed (${error.message}) and released stock could not be restored (${inventoryRollbackError.message}). Inventory requires manual reconciliation.`,
          500
        );
      }
    }

    throw error;
  }
};

/*
|--------------------------------------------------------------------------
| 5. Customer Cancels Order
|--------------------------------------------------------------------------
|
| Customer may cancel pending-payment orders or confirmed
| orders before processing, subject to payment restrictions.
|--------------------------------------------------------------------------
*/

export const cancelCustomerOrder = async (
  userId,
  orderId
) => {
  const validatedUserId =
    validateUserId(userId);

  const validatedOrderId =
    validateObjectId(
      orderId,
      "order ID"
    );

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

  if (
    !["pending_payment", "confirmed"].includes(
      order.orderStatus
    )
  ) {
    throw createError(
      "This order can no longer be cancelled by the customer.",
      409
    );
  }

  return transitionOrderStatus(
    order,
    "cancelled"
  );
};

/*
|--------------------------------------------------------------------------
| 6. List All Orders For Admin
|--------------------------------------------------------------------------
*/

export const listAdminOrders = async (
  options = {}
) => {
  const { page, limit } =
    parsePagination(options);

  const filter = {};

  const allowedStatuses = [
    "pending_payment",
    "confirmed",
    "processing",
    "shipped",
    "delivered",
    "cancelled",
    "return_requested",
    "returned",
  ];

  const allowedPaymentStatuses = [
    "pending",
    "authorized",
    "paid",
    "failed",
    "partially_refunded",
    "refunded",
  ];

  if (options.status) {
    if (options.status === "open") {
      filter.orderStatus = { $in: openAdminOrderStatuses };
    } else {
    if (!allowedStatuses.includes(options.status)) {
      throw createError(
        "Invalid order status filter.",
        400
      );
    }

    filter.orderStatus = options.status;
    }
  }

  if (options.paymentStatus) {
    if (
      !allowedPaymentStatuses.includes(
        options.paymentStatus
      )
    ) {
      throw createError(
        "Invalid payment status filter.",
        400
      );
    }

    filter.paymentStatus = options.paymentStatus;
  }

  if (
    typeof options.search === "string" &&
    options.search.trim()
  ) {
    const escapedSearch = options.search
      .trim()
      .replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

    const searchRegex = new RegExp(
      escapedSearch,
      "i"
    );

    filter.$or = [
      { orderNumber: searchRegex },
      { customerName: searchRegex },
      { customerEmail: searchRegex },
    ];
  }

  const skip = (page - 1) * limit;

  const [orders, total] = await Promise.all([
    Order.find(filter)
      .sort({
        createdAt: -1,
        _id: -1,
      })
      .skip(skip)
      .limit(limit)
      .lean(),

    Order.countDocuments(filter),
  ]);

  return {
    orders,
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
| 7. Get One Order For Admin
|--------------------------------------------------------------------------
*/

export const getAdminOrderById = async (
  orderId
) => {
  const validatedOrderId =
    validateObjectId(
      orderId,
      "order ID"
    );

  const order = await Order.findById(
    validatedOrderId
  ).lean();

  if (!order) {
    throw createError(
      "Order not found.",
      404
    );
  }

  return order;
};

/*
|--------------------------------------------------------------------------
| 8. Update Order Status For Admin
|--------------------------------------------------------------------------
|
| Payment-related state changes must be performed by the
| payment module. Razorpay orders are not confirmed unless
| the payment status is authorized or paid.
|--------------------------------------------------------------------------
*/

export const updateOrderStatus = async (
  orderId,
  newStatus
) => {
  const validatedOrderId =
    validateObjectId(
      orderId,
      "order ID"
    );

  const order = await Order.findById(
    validatedOrderId
  );

  if (!order) {
    throw createError(
      "Order not found.",
      404
    );
  }

  return transitionOrderStatus(
    order,
    newStatus
  );
};
