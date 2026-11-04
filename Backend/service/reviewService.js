import Product from "../models/Product.js";
import ProductReview from "../models/ProductReview.js";
import Order from "../models/Order.js";

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

const publicProductForReview = async (slug) => {
  const normalizedSlug = String(slug ?? "").trim().toLowerCase();

  if (!normalizedSlug) {
    throw createError("Product slug is required.", 400);
  }

  const product = await Product.findOne({
    slug: normalizedSlug,
    status: "active",
  })
    .populate("category", "isActive")
    .lean();

  if (!product?.category?.isActive) {
    throw createError("Product not found.", 404);
  }

  return product;
};

const reviewAdminPopulate = [
  { path: "product", select: "name slug primaryImage" },
  { path: "user", select: "name email" },
  { path: "order", select: "orderNumber orderStatus" },
  { path: "moderatedBy", select: "name email" },
];

export const createCustomerReview = async (
  userId,
  productId,
  data
) => {
  const customerId = validateObjectId(userId, "customer ID");
  const validatedProductId = validateObjectId(
    productId,
    "product ID"
  );
  const orderId = validateObjectId(data?.orderId, "order ID");

  const product = await Product.findOne({
    _id: validatedProductId,
    status: "active",
  }).select("_id");

  if (!product) {
    throw createError("Active product not found.", 404);
  }

  const order = await Order.findOne({
    _id: orderId,
    user: customerId,
    orderStatus: "delivered",
    "items.product": product._id,
  })
    .select("_id items.product")
    .lean();

  if (!order) {
    throw createError(
      "A review can be submitted only for a product in your delivered order.",
      403
    );
  }

  try {
    const [review] = await ProductReview.create([{
      product: product._id,
      user: customerId,
      order: order._id,
      rating: data.rating,
      title: data.title ?? "",
      comment: data.comment ?? "",
      isVerifiedPurchase: true,
      status: "pending",
    }]);

    return review.toObject();
  } catch (error) {
    if (error.code === 11000) {
      throw createError(
        "You have already reviewed this product for this order.",
        409
      );
    }

    throw error;
  }
};

export const listPublicProductReviews = async (
  slug,
  options = {}
) => {
  const { page, limit } = parsePagination(options);
  const product = await publicProductForReview(slug);
  const filter = {
    product: product._id,
    status: "approved",
  };

  if (options.rating !== undefined && options.rating !== "") {
    const rating = Number(options.rating);
    if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
      throw createError("Rating filter must be an integer from 1 to 5.", 400);
    }

    filter.rating = rating;
  }

  const allowedSorts = {
    newest: { createdAt: -1, _id: -1 },
    oldest: { createdAt: 1, _id: 1 },
    highest: { rating: -1, createdAt: -1 },
    lowest: { rating: 1, createdAt: -1 },
  };
  const sort = allowedSorts[options.sort ?? "newest"];

  if (!sort) {
    throw createError(
      "Sort must be newest, oldest, highest, or lowest.",
      400
    );
  }

  const skip = (page - 1) * limit;
  const [reviews, total] = await Promise.all([
    ProductReview.find(filter)
      .select("user rating title comment isVerifiedPurchase createdAt")
      .populate("user", "name")
      .sort(sort)
      .skip(skip)
      .limit(limit)
      .lean(),
    ProductReview.countDocuments(filter),
  ]);

  const [summary] = await ProductReview.aggregate([
    { $match: { product: product._id, status: "approved" } },
    {
      $group: {
        _id: null,
        reviewCount: { $sum: 1 },
        averageRating: { $avg: "$rating" },
      },
    },
  ]);

  return {
    product: {
      id: product._id,
      name: product.name,
      slug: product.slug,
    },
    reviews,
    summary: {
      reviewCount: summary?.reviewCount ?? 0,
      averageRating: summary
        ? Math.round(summary.averageRating * 100) / 100
        : 0,
    },
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  };
};

export const listCustomerReviews = async (userId, options = {}) => {
  const customerId = validateObjectId(userId, "customer ID");
  const { page, limit } = parsePagination(options);
  const filter = { user: customerId };

  if (options.status) {
    if (!["pending", "approved", "rejected"].includes(options.status)) {
      throw createError("Invalid review status filter.", 400);
    }

    filter.status = options.status;
  }

  const skip = (page - 1) * limit;
  const [reviews, total] = await Promise.all([
    ProductReview.find(filter)
      .populate("product", "name slug primaryImage")
      .populate("order", "orderNumber orderStatus")
      .sort({ createdAt: -1, _id: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),
    ProductReview.countDocuments(filter),
  ]);

  return {
    reviews,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  };
};

export const updateCustomerReview = async (
  userId,
  reviewId,
  data
) => {
  const customerId = validateObjectId(userId, "customer ID");
  const validatedReviewId = validateObjectId(reviewId, "review ID");
  const update = {
    ...data,
    status: "pending",
    moderatedAt: null,
    moderatedBy: null,
    rejectionReason: "",
  };

  const review = await ProductReview.findOneAndUpdate(
    {
      _id: validatedReviewId,
      user: customerId,
    },
    { $set: update },
    { returnDocument: "after", runValidators: true }
  );

  if (!review) {
    throw createError("Review not found.", 404);
  }

  return review.toObject();
};

export const deleteCustomerReview = async (userId, reviewId) => {
  const customerId = validateObjectId(userId, "customer ID");
  const validatedReviewId = validateObjectId(reviewId, "review ID");
  const review = await ProductReview.findOneAndDelete({
    _id: validatedReviewId,
    user: customerId,
  });

  if (!review) {
    throw createError("Review not found.", 404);
  }

  return { id: String(review._id) };
};

export const listAdminReviews = async (options = {}) => {
  const { page, limit } = parsePagination(options);
  const filter = {};

  if (options.status) {
    if (!["pending", "approved", "rejected"].includes(options.status)) {
      throw createError("Invalid review status filter.", 400);
    }

    filter.status = options.status;
  }

  if (options.productId) {
    filter.product = validateObjectId(options.productId, "product ID");
  }

  if (typeof options.search === "string" && options.search.trim()) {
    const search = options.search.trim();
    if (search.length > 100) {
      throw createError("Search text cannot exceed 100 characters.", 400);
    }

    const escaped = search.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const regex = new RegExp(escaped, "i");
    filter.$or = [{ title: regex }, { comment: regex }];
  }

  const skip = (page - 1) * limit;
  const [reviews, total] = await Promise.all([
    ProductReview.find(filter)
      .populate(reviewAdminPopulate)
      .sort({ createdAt: -1, _id: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),
    ProductReview.countDocuments(filter),
  ]);

  return {
    reviews,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  };
};

export const getAdminReviewById = async (reviewId) => {
  const validatedReviewId = validateObjectId(reviewId, "review ID");
  const review = await ProductReview.findById(validatedReviewId)
    .populate(reviewAdminPopulate)
    .lean();

  if (!review) {
    throw createError("Review not found.", 404);
  }

  return review;
};

export const moderateReview = async (
  adminId,
  reviewId,
  data
) => {
  const moderatorId = validateObjectId(adminId, "admin ID");
  const validatedReviewId = validateObjectId(reviewId, "review ID");
  const status = data.decision === "approve" ? "approved" : "rejected";

  const review = await ProductReview.findOneAndUpdate(
    {
      _id: validatedReviewId,
      status: "pending",
    },
    {
      $set: {
        status,
        moderatedAt: new Date(),
        moderatedBy: moderatorId,
        rejectionReason:
          status === "rejected" ? data.rejectionReason : "",
      },
    },
    { returnDocument: "after", runValidators: true }
  );

  if (!review) {
    const exists = await ProductReview.exists({
      _id: validatedReviewId,
    });
    throw createError(
      exists
        ? "Only pending reviews can be moderated."
        : "Review not found.",
      exists ? 409 : 404
    );
  }

  return review.toObject();
};

export const getProductReviewSummaries = async (productIds) => {
  if (!Array.isArray(productIds) || productIds.length === 0) {
    return {};
  }

  const summaries = await ProductReview.aggregate([
    {
      $match: {
        product: { $in: productIds },
        status: "approved",
      },
    },
    {
      $group: {
        _id: "$product",
        reviewCount: { $sum: 1 },
        averageRating: { $avg: "$rating" },
      },
    },
  ]);

  return Object.fromEntries(
    summaries.map((summary) => [
      String(summary._id),
      {
        reviewCount: summary.reviewCount,
        averageRating:
          Math.round(summary.averageRating * 100) / 100,
      },
    ])
  );
};
