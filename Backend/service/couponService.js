import mongoose from "mongoose";

import Coupon from "../models/Coupon.js";
import CouponRedemption from "../models/CouponRedemption.js";
import CouponUserUsage from "../models/CouponUserUsage.js";
import Cart from "../models/Cart.js";
import Category from "../models/Category.js";
import Product from "../models/Product.js";
import ProductVariant from "../models/ProductVariant.js";

const createError = (message, statusCode) => {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
};

const isValidObjectId = (value) =>
  typeof value === "string" &&
  /^[a-f\d]{24}$/i.test(value);

const validateObjectId = (value, fieldName) => {
  const normalized = value == null ? "" : String(value);
  if (!isValidObjectId(normalized)) {
    throw createError(`Invalid ${fieldName}.`, 400);
  }

  return normalized;
};

const roundMoney = (value) =>
  Math.round((Number(value) + Number.EPSILON) * 100) / 100;

const parsePagination = (options = {}) => {
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

  return { page, limit };
};

const normalizeCouponCode = (code) =>
  typeof code === "string" ? code.trim().toUpperCase() : "";

const getUsableCoupon = async (code, userId, { allowInactive = false } = {}) => {
  const normalizedCode = normalizeCouponCode(code);
  if (!normalizedCode) {
    throw createError("Coupon code is required.", 400);
  }

  const now = new Date();
  const coupon = await Coupon.findOne({
    code: normalizedCode,
    ...(allowInactive ? {} : { isActive: true }),
    startsAt: { $lte: now },
    expiresAt: { $gt: now },
  }).lean();

  if (!coupon) {
    throw createError(
      "Coupon is invalid, inactive, not yet available, or expired.",
      422
    );
  }

  if (
    coupon.usageLimit != null &&
    Number(coupon.usageCount) >= Number(coupon.usageLimit)
  ) {
    throw createError("Coupon usage limit has been reached.", 422);
  }

  if (userId) {
    const userUsage = await CouponUserUsage.findOne({
      coupon: coupon._id,
      user: userId,
    }).select("usageCount").lean();

    if (
      Number(userUsage?.usageCount ?? 0) >=
      Number(coupon.perUserLimit)
    ) {
      throw createError(
        "You have reached the usage limit for this coupon.",
        422
      );
    }
  }

  return coupon;
};

export const calculateCouponDiscount = (coupon, items, orderSubtotal) => {
  const subtotal = roundMoney(orderSubtotal);
  if (subtotal < Number(coupon.minimumOrderValue ?? 0)) {
    throw createError(
      `The order subtotal must be at least ${Number(coupon.minimumOrderValue)} to use this coupon.`,
      422
    );
  }

  const categoryIds = new Set(
    (coupon.applicableCategories ?? []).map(String)
  );
  const productIds = new Set(
    (coupon.applicableProducts ?? []).map(String)
  );
  const hasRestrictions =
    categoryIds.size > 0 || productIds.size > 0;
  const eligibleItems = items
    .map((item, index) => {
      const productMatches =
        productIds.has(String(item.product));
      const categoryMatches =
        categoryIds.has(String(item.category));

      return {
        index,
        lineTotal: Number(item.lineTotal),
        eligible: !hasRestrictions ||
          productMatches ||
          categoryMatches,
      };
    })
    .filter((item) => item.eligible && item.lineTotal > 0);
  const eligibleSubtotal = roundMoney(
    eligibleItems.reduce(
      (total, item) => total + item.lineTotal,
      0
    )
  );

  if (eligibleSubtotal <= 0) {
    throw createError(
      "Coupon does not apply to the products in this order.",
      422
    );
  }

  let discountAmount =
    coupon.discountType === "percentage"
      ? eligibleSubtotal * Number(coupon.discountValue) / 100
      : Number(coupon.discountValue);

  if (coupon.discountType === "percentage" && coupon.maxDiscount != null) {
    discountAmount = Math.min(
      discountAmount,
      Number(coupon.maxDiscount)
    );
  }

  discountAmount = roundMoney(
    Math.min(discountAmount, eligibleSubtotal, subtotal)
  );

  if (discountAmount <= 0) {
    throw createError("Coupon discount must be greater than zero.", 422);
  }

  let remainingDiscount = discountAmount;
  const itemDiscounts = items.map(() => 0);

  eligibleItems.forEach((item, index) => {
    const allocated = index === eligibleItems.length - 1
      ? remainingDiscount
      : roundMoney(
          discountAmount * item.lineTotal / eligibleSubtotal
        );
    const boundedAllocation = roundMoney(
      Math.max(
        0,
        Math.min(allocated, item.lineTotal, remainingDiscount)
      )
    );
    itemDiscounts[item.index] = boundedAllocation;
    remainingDiscount = roundMoney(
      remainingDiscount - boundedAllocation
    );
  });

  return {
    discountAmount,
    eligibleSubtotal,
    totalAmount: roundMoney(subtotal - discountAmount),
    itemDiscounts,
  };
};

const buildCartPricingItems = async (userId) => {
  const cart = await Cart.findOne({ user: userId }).lean();
  if (!cart?.items?.length) {
    throw createError("Your cart is empty.", 400);
  }

  const items = [];
  let subtotal = 0;

  for (const cartItem of cart.items) {
    const quantity = Number(cartItem.quantity);
    if (!Number.isInteger(quantity) || quantity < 1 || quantity > 20) {
      throw createError(
        "Cart quantity must be a whole number between 1 and 20.",
        409
      );
    }

    const product = await Product.findOne({
      _id: cartItem.product,
      status: "active",
    })
      .select("_id basePrice salePrice category")
      .populate("category", "isActive")
      .lean();

    if (!product?.category?.isActive) {
      throw createError(
        "A product in your cart is no longer available.",
        409
      );
    }

    let priceAdjustment = 0;
    if (cartItem.variant) {
      const variant = await ProductVariant.findOne({
        _id: cartItem.variant,
        product: product._id,
        isActive: true,
      }).select("priceAdjustment").lean();

      if (!variant) {
        throw createError(
          "A selected product variant is no longer available.",
          409
        );
      }

      priceAdjustment = Number(variant.priceAdjustment ?? 0);
    }

    const unitPrice = roundMoney(
      Number(product.salePrice ?? product.basePrice) +
      priceAdjustment
    );
    if (!Number.isFinite(unitPrice) || unitPrice < 0) {
      throw createError(
        "A product in your cart has an invalid price.",
        409
      );
    }
    const lineTotal = roundMoney(
      unitPrice * quantity
    );
    subtotal = roundMoney(subtotal + lineTotal);
    items.push({
      product: product._id,
      category: product.category._id,
      lineTotal,
    });
  }

  return { items, subtotal };
};

export const validateCouponForCart = async (userId, code) => {
  const customerId = validateObjectId(userId, "customer ID");
  const [coupon, cartPricing] = await Promise.all([
    getUsableCoupon(code, customerId),
    buildCartPricingItems(customerId),
  ]);
  const {
    itemDiscounts: _itemDiscounts,
    ...discount
  } = calculateCouponDiscount(
    coupon,
    cartPricing.items,
    cartPricing.subtotal
  );

  return {
    code: coupon.code,
    description: coupon.description,
    discountType: coupon.discountType,
    discountValue: coupon.discountValue,
    subtotal: cartPricing.subtotal,
    ...discount,
  };
};

export const reserveCouponUsage = async (coupon, userId) => {
  const customerId = validateObjectId(userId, "customer ID");
  const now = new Date();
  const globalFilter = {
    _id: coupon._id,
    isActive: true,
    startsAt: { $lte: now },
    expiresAt: { $gt: now },
    $or: [
      { usageLimit: null },
      { usageLimit: { $exists: false } },
      {
        $expr: {
          $lt: [
            { $ifNull: ["$usageCount", 0] },
            "$usageLimit",
          ],
        },
      },
    ],
  };

  const session = await mongoose.startSession();
  let claimedCoupon;
  try {
    await session.withTransaction(async () => {
      claimedCoupon = null;
      claimedCoupon = await Coupon.findOneAndUpdate(
        globalFilter,
        { $inc: { usageCount: 1 } },
        { returnDocument: "after", session }
      );

      if (!claimedCoupon) {
        throw createError(
          "Coupon is no longer available or its usage limit was reached.",
          409
        );
      }

      await CouponUserUsage.updateOne(
        {
          coupon: claimedCoupon._id,
          user: customerId,
        },
        {
          $setOnInsert: {
            coupon: claimedCoupon._id,
            user: customerId,
            usageCount: 0,
          },
        },
        { upsert: true, session }
      );

      const userClaim = await CouponUserUsage.findOneAndUpdate(
        {
          coupon: claimedCoupon._id,
          user: customerId,
          $expr: {
            $lt: [
              { $ifNull: ["$usageCount", 0] },
              claimedCoupon.perUserLimit,
            ],
          },
        },
        { $inc: { usageCount: 1 } },
        { returnDocument: "after", session }
      );

      if (!userClaim) {
        throw createError(
          "You have reached the usage limit for this coupon.",
          409
        );
      }
    });
  } catch (error) {
    if (error.code === 11000) {
      throw createError(
        "Coupon usage was claimed concurrently. Retry checkout.",
        409
      );
    }

    throw error;
  } finally {
    await session.endSession();
  }

  return {
    couponId: claimedCoupon._id,
    userId: customerId,
    code: claimedCoupon.code,
  };
};

export const recordCouponRedemption = async ({
  reservation,
  orderId,
  discountAmount,
  redeemed,
}) => {
  const validatedOrderId = validateObjectId(orderId, "order ID");
  try {
    return await CouponRedemption.create({
      coupon: reservation.couponId,
      user: reservation.userId,
      order: validatedOrderId,
      code: reservation.code,
      discountAmount,
      status: redeemed ? "redeemed" : "reserved",
      redeemedAt: redeemed ? new Date() : null,
    });
  } catch (error) {
    if (error.code === 11000) {
      throw createError(
        "A coupon redemption already exists for this order.",
        409
      );
    }

    throw error;
  }
};

const decrementCouponCounters = async (couponId, userId) => {
  const session = await mongoose.startSession();
  try {
    await session.withTransaction(async () => {
      const couponResult = await Coupon.updateOne(
        {
          _id: couponId,
          usageCount: { $gt: 0 },
        },
        { $inc: { usageCount: -1 } },
        { session }
      );
      const userResult = await CouponUserUsage.updateOne(
        {
          coupon: couponId,
          user: userId,
          usageCount: { $gt: 0 },
        },
        { $inc: { usageCount: -1 } },
        { session }
      );

      if (
        couponResult.modifiedCount !== 1 ||
        userResult.modifiedCount !== 1
      ) {
        throw createError(
          "Coupon usage counters are inconsistent. Manual reconciliation is required.",
          409
        );
      }
    });
  } finally {
    await session.endSession();
  }
};

export const releaseCouponReservation = async (reservation) => {
  await decrementCouponCounters(
    reservation.couponId,
    reservation.userId
  );
};

export const releaseCouponRedemptionForOrder = async (orderId) => {
  const validatedOrderId = validateObjectId(orderId, "order ID");
  const session = await mongoose.startSession();
  let released = false;
  try {
    await session.withTransaction(async () => {
      released = false;
      const redemption = await CouponRedemption.findOneAndUpdate(
        {
          order: validatedOrderId,
          status: { $in: ["reserved", "redeemed"] },
        },
        {
          $set: {
            status: "released",
            releasedAt: new Date(),
          },
        },
        { returnDocument: "after", session }
      );

      if (!redemption) {
        return;
      }

      const couponResult = await Coupon.updateOne(
        {
          _id: redemption.coupon,
          usageCount: { $gt: 0 },
        },
        { $inc: { usageCount: -1 } },
        { session }
      );
      const userResult = await CouponUserUsage.updateOne(
        {
          coupon: redemption.coupon,
          user: redemption.user,
          usageCount: { $gt: 0 },
        },
        { $inc: { usageCount: -1 } },
        { session }
      );

      if (
        couponResult.modifiedCount !== 1 ||
        userResult.modifiedCount !== 1
      ) {
        throw createError(
          "Coupon usage counters are inconsistent. Manual reconciliation is required.",
          409
        );
      }

      released = true;
    });
    return released;
  } finally {
    await session.endSession();
  }
};

export const redeemCouponForOrder = async (orderId) => {
  const validatedOrderId = validateObjectId(orderId, "order ID");
  await CouponRedemption.updateOne(
    {
      order: validatedOrderId,
      status: "reserved",
    },
    {
      $set: {
        status: "redeemed",
        redeemedAt: new Date(),
      },
    }
  );
};

export const listAdminCoupons = async (options = {}) => {
  const { page, limit } = parsePagination(options);
  const filter = {};

  if (options.isActive !== undefined && options.isActive !== "") {
    if (!["true", "false", true, false].includes(options.isActive)) {
      throw createError("isActive must be true or false.", 400);
    }

    filter.isActive = options.isActive === true || options.isActive === "true";
  }

  if (typeof options.search === "string" && options.search.trim()) {
    const search = options.search.trim();
    if (search.length > 50) {
      throw createError("Search cannot exceed 50 characters.", 400);
    }

    const escaped = search.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    filter.code = new RegExp(escaped, "i");
  }

  const skip = (page - 1) * limit;
  const [coupons, total] = await Promise.all([
    Coupon.find(filter)
      .populate("applicableCategories", "name slug")
      .populate("applicableProducts", "name slug sku")
      .populate("createdBy", "name email")
      .sort({ createdAt: -1, _id: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),
    Coupon.countDocuments(filter),
  ]);

  return {
    coupons,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  };
};

export const listCurrentPublicOffers = async () => {
  const now = new Date();
  const coupons = await Coupon.find({
    isActive: true,
    startsAt: { $lte: now },
    expiresAt: { $gt: now },
    $or: [
      { usageLimit: null },
      { $expr: { $lt: [{ $ifNull: ["$usageCount", 0] }, "$usageLimit"] } },
    ],
  })
    .select("code description discountType discountValue maxDiscount minimumOrderValue startsAt expiresAt applicableCategories applicableProducts")
    .sort({ expiresAt: 1, createdAt: -1 })
    .limit(20)
    .lean();

  return coupons.map((coupon) => ({
    code: coupon.code,
    description: coupon.description,
    discountType: coupon.discountType,
    discountValue: coupon.discountValue,
    maxDiscount: coupon.maxDiscount,
    minimumOrderValue: coupon.minimumOrderValue,
    startsAt: coupon.startsAt,
    expiresAt: coupon.expiresAt,
    isRestricted: Boolean(coupon.applicableCategories?.length || coupon.applicableProducts?.length),
  }));
};

const validateCouponReferences = async (data) => {
  const categoryIds = data.applicableCategories ?? [];
  const productIds = data.applicableProducts ?? [];

  if (categoryIds.length) {
    const count = await Category.countDocuments({
      _id: { $in: categoryIds },
    });
    if (count !== new Set(categoryIds.map(String)).size) {
      throw createError(
        "One or more applicable categories do not exist.",
        400
      );
    }
  }

  if (productIds.length) {
    const count = await Product.countDocuments({
      _id: { $in: productIds },
    });
    if (count !== new Set(productIds.map(String)).size) {
      throw createError(
        "One or more applicable products do not exist.",
        400
      );
    }
  }
};

export const createAdminCoupon = async (adminId, data) => {
  const validatedAdminId = validateObjectId(adminId, "admin ID");
  await validateCouponReferences(data);
  try {
    return await Coupon.create({
      ...data,
      code: normalizeCouponCode(data.code),
      createdBy: validatedAdminId,
    });
  } catch (error) {
    if (error.code === 11000) {
      throw createError("A coupon with this code already exists.", 409);
    }
    throw error;
  }
};

export const getAdminCouponById = async (couponId) => {
  const validatedCouponId = validateObjectId(couponId, "coupon ID");
  const coupon = await Coupon.findById(validatedCouponId)
    .populate("applicableCategories", "name slug")
    .populate("applicableProducts", "name slug sku")
    .populate("createdBy", "name email")
    .lean();
  if (!coupon) {
    throw createError("Coupon not found.", 404);
  }
  return coupon;
};

export const updateAdminCoupon = async (couponId, data) => {
  const validatedCouponId = validateObjectId(couponId, "coupon ID");
  const coupon = await Coupon.findById(validatedCouponId);
  if (!coupon) {
    throw createError("Coupon not found.", 404);
  }

  if (Object.hasOwn(data, "usageLimit") && data.usageLimit != null &&
    data.usageLimit < coupon.usageCount) {
    throw createError(
      "Usage limit cannot be lower than the number of already reserved or redeemed uses.",
      409
    );
  }

  await validateCouponReferences({
    applicableCategories:
      data.applicableCategories ?? coupon.applicableCategories.map(String),
    applicableProducts:
      data.applicableProducts ?? coupon.applicableProducts.map(String),
  });

  Object.assign(coupon, {
    ...data,
    ...(data.code ? { code: normalizeCouponCode(data.code) } : {}),
  });

  try {
    await coupon.save();
    return coupon.toObject();
  } catch (error) {
    if (error.code === 11000) {
      throw createError("A coupon with this code already exists.", 409);
    }
    throw error;
  }
};

export const setAdminCouponStatus = async (couponId, isActive) => {
  const validatedCouponId = validateObjectId(couponId, "coupon ID");
  const coupon = await Coupon.findByIdAndUpdate(
    validatedCouponId,
    { $set: { isActive } },
    { returnDocument: "after", runValidators: true }
  );
  if (!coupon) {
    throw createError("Coupon not found.", 404);
  }
  return coupon.toObject();
};

export const deleteAdminCoupon = async (couponId) => {
  const validatedCouponId = validateObjectId(couponId, "coupon ID");
  const coupon = await Coupon.findOneAndDelete({
    _id: validatedCouponId,
    $or: [
      { usageCount: 0 },
      { usageCount: null },
      { usageCount: { $exists: false } },
    ],
  });
  if (coupon) {
    return { id: String(coupon._id), deleted: true };
  }

  const exists = await Coupon.exists({ _id: validatedCouponId });
  if (!exists) {
    throw createError("Coupon not found.", 404);
  }

  throw createError(
    "A coupon with reserved or redeemed uses cannot be deleted; deactivate it instead.",
    409
  );
};

export const getCouponForOrder = async (userId, code, items, subtotal) => {
  const customerId = validateObjectId(userId, "customer ID");
  const coupon = await getUsableCoupon(code, customerId);
  return {
    coupon,
    ...calculateCouponDiscount(coupon, items, subtotal),
  };
};
