import test from "node:test";
import assert from "node:assert/strict";

import Order from "../models/Order.js";
import Category from "../models/Category.js";
import Product from "../models/Product.js";
import ProductVariant from "../models/ProductVariant.js";
import Inventory from "../models/Inventory.js";
import ProductReview from "../models/ProductReview.js";
import { listProducts } from "../service/productService.js";
import {
  createCustomerReview,
  deleteCustomerReview,
  getProductReviewSummaries,
  listAdminReviews,
  listPublicProductReviews,
  moderateReview,
  updateCustomerReview,
} from "../service/reviewService.js";
import {
  createReviewSchema,
  moderateReviewSchema,
  updateReviewSchema,
} from "../validations/reviewValidation.js";

const CUSTOMER_ID = "507f1f77bcf86cd799439011";
const ADMIN_ID = "507f1f77bcf86cd799439012";
const PRODUCT_ID = "507f1f77bcf86cd799439013";
const ORDER_ID = "507f1f77bcf86cd799439014";
const REVIEW_ID = "507f1f77bcf86cd799439015";

const queryWith = (value) => ({
  select() {
    return this;
  },
  populate() {
    return this;
  },
  sort() {
    return this;
  },
  skip() {
    return this;
  },
  limit() {
    return this;
  },
  lean: async () => value,
  then(resolve, reject) {
    return Promise.resolve(value).then(resolve, reject);
  },
});

test("review request schemas reject spoofed fields and invalid values", () => {
  assert.equal(
    createReviewSchema.safeParse({
      orderId: ORDER_ID,
      rating: 5,
      isVerifiedPurchase: true,
    }).success,
    false
  );
  assert.equal(
    createReviewSchema.safeParse({
      orderId: ORDER_ID,
      rating: 6,
    }).success,
    false
  );
  assert.equal(
    updateReviewSchema.safeParse({}).success,
    false
  );
  assert.equal(
    moderateReviewSchema.safeParse({
      decision: "reject",
    }).success,
    false
  );
});

test("creates verified reviews only for the customer's delivered order", async (t) => {
  t.mock.method(Product, "findOne", () =>
    queryWith({ _id: PRODUCT_ID })
  );
  t.mock.method(Order, "findOne", (filter) => {
    assert.equal(filter._id, ORDER_ID);
    assert.equal(filter.user, CUSTOMER_ID);
    assert.equal(filter.orderStatus, "delivered");
    assert.equal(filter["items.product"], PRODUCT_ID);
    return queryWith({ _id: ORDER_ID });
  });
  t.mock.method(ProductReview, "create", async ([review]) => [{
    ...review,
    _id: REVIEW_ID,
    toObject() {
      return { ...review, _id: REVIEW_ID };
    },
  }]);

  const review = await createCustomerReview(
    CUSTOMER_ID,
    PRODUCT_ID,
    { orderId: ORDER_ID, rating: 5, comment: "Lovely" }
  );

  assert.equal(review.status, "pending");
  assert.equal(review.isVerifiedPurchase, true);
  assert.equal(review.user, CUSTOMER_ID);
});

test("rejects a review when the customer's order is not delivered or eligible", async (t) => {
  t.mock.method(Product, "findOne", () =>
    queryWith({ _id: PRODUCT_ID })
  );
  t.mock.method(Order, "findOne", () => queryWith(null));
  t.mock.method(ProductReview, "create", () => {
    throw new Error("Review creation must not be reached");
  });

  await assert.rejects(
    createCustomerReview(
      CUSTOMER_ID,
      PRODUCT_ID,
      { orderId: ORDER_ID, rating: 4 }
    ),
    (error) => error.statusCode === 403
  );
});

test("reports duplicate product reviews for the same order as a conflict", async (t) => {
  t.mock.method(Product, "findOne", () =>
    queryWith({ _id: PRODUCT_ID })
  );
  t.mock.method(Order, "findOne", () =>
    queryWith({ _id: ORDER_ID })
  );
  t.mock.method(ProductReview, "create", async () => {
    const error = new Error("duplicate");
    error.code = 11000;
    throw error;
  });

  await assert.rejects(
    createCustomerReview(
      CUSTOMER_ID,
      PRODUCT_ID,
      { orderId: ORDER_ID, rating: 4 }
    ),
    (error) => error.statusCode === 409
  );
});

test("updates only the owner review and returns it to moderation", async (t) => {
  t.mock.method(
    ProductReview,
    "findOneAndUpdate",
    async (filter, update, options) => {
      assert.deepEqual(filter, {
        _id: REVIEW_ID,
        user: CUSTOMER_ID,
      });
      assert.equal(update.$set.rating, 3);
      assert.equal(update.$set.status, "pending");
      assert.equal(update.$set.moderatedAt, null);
      assert.equal(update.$set.moderatedBy, null);
      assert.equal(update.$set.rejectionReason, "");
      assert.equal(options.runValidators, true);
      return {
        ...update.$set,
        _id: REVIEW_ID,
        toObject() {
          return { ...this };
        },
      };
    }
  );

  const review = await updateCustomerReview(
    CUSTOMER_ID,
    REVIEW_ID,
    { rating: 3 }
  );

  assert.equal(review.status, "pending");
});

test("customer review deletion is scoped to the authenticated owner", async (t) => {
  t.mock.method(
    ProductReview,
    "findOneAndDelete",
    async (filter) => {
      assert.deepEqual(filter, {
        _id: REVIEW_ID,
        user: CUSTOMER_ID,
      });
      return null;
    }
  );

  await assert.rejects(
    deleteCustomerReview(CUSTOMER_ID, REVIEW_ID),
    (error) => error.statusCode === 404
  );
});

test("public product review endpoint returns approved content and approved-only summary", async (t) => {
  t.mock.method(Product, "findOne", () => ({
    populate() {
      return this;
    },
    lean: async () => ({
      _id: PRODUCT_ID,
      name: "Silk Saree",
      slug: "silk-saree",
      category: { isActive: true },
    }),
  }));
  t.mock.method(ProductReview, "find", (filter) => {
    assert.equal(filter.status, "approved");
    assert.equal(filter.product, PRODUCT_ID);
    return queryWith([{
      rating: 5,
      comment: "Excellent",
      user: { name: "Customer" },
    }]);
  });
  t.mock.method(ProductReview, "countDocuments", async (filter) => {
    assert.equal(filter.status, "approved");
    return 1;
  });
  t.mock.method(ProductReview, "aggregate", async (pipeline) => {
    assert.deepEqual(pipeline[0].$match, {
      product: PRODUCT_ID,
      status: "approved",
    });
    return [{ reviewCount: 1, averageRating: 5 }];
  });

  const result = await listPublicProductReviews("silk-saree");

  assert.equal(result.reviews.length, 1);
  assert.equal(result.summary.reviewCount, 1);
  assert.equal(result.summary.averageRating, 5);
});

test("admin moderation is atomic and rejects a stale moderation attempt", async (t) => {
  t.mock.method(
    ProductReview,
    "findOneAndUpdate",
    async (filter, update) => {
      assert.deepEqual(filter, {
        _id: REVIEW_ID,
        status: "pending",
      });
      assert.equal(update.$set.status, "rejected");
      assert.equal(update.$set.moderatedBy, ADMIN_ID);
      assert.equal(
        update.$set.rejectionReason,
        "Not appropriate"
      );
      return null;
    }
  );
  t.mock.method(ProductReview, "exists", async () => true);

  await assert.rejects(
    moderateReview(ADMIN_ID, REVIEW_ID, {
      decision: "reject",
      rejectionReason: "Not appropriate",
    }),
    (error) => error.statusCode === 409
  );
});

test("review summaries aggregate approved reviews in one batch", async (t) => {
  t.mock.method(ProductReview, "aggregate", async (pipeline) => {
    assert.deepEqual(pipeline[0].$match, {
      product: { $in: [PRODUCT_ID] },
      status: "approved",
    });
    return [{
      _id: PRODUCT_ID,
      reviewCount: 2,
      averageRating: 4.5,
    }];
  });

  assert.deepEqual(
    await getProductReviewSummaries([PRODUCT_ID]),
    {
      [PRODUCT_ID]: {
        reviewCount: 2,
        averageRating: 4.5,
      },
    }
  );
});

test("public product listing includes approved review summaries", async (t) => {
  t.mock.method(Category, "distinct", async () => []);
  t.mock.method(ProductVariant, "find", () => queryWith([]));
  t.mock.method(Inventory, "find", () => queryWith([]));
  t.mock.method(Product, "find", () =>
    queryWith([{
      _id: PRODUCT_ID,
      name: "Silk Saree",
    }])
  );
  t.mock.method(Product, "countDocuments", async () => 1);
  t.mock.method(ProductReview, "aggregate", async () => [{
    _id: PRODUCT_ID,
    reviewCount: 3,
    averageRating: 4.6666667,
  }]);

  const result = await listProducts();

  assert.deepEqual(result.products[0].reviewSummary, {
    reviewCount: 3,
    averageRating: 4.67,
  });
});

test("admin review list validates pagination and escapes search input", async (t) => {
  t.mock.method(ProductReview, "find", (filter) => {
    assert.equal(filter.status, "pending");
    assert.equal(filter.$or[0].title.source, "a\\.\\*\\[");
    return queryWith([]);
  });
  t.mock.method(ProductReview, "countDocuments", async () => 0);

  await listAdminReviews({
    status: "pending",
    search: "a.*[",
    page: "1",
    limit: "10",
  });

  await assert.rejects(
    listAdminReviews({ limit: 101 }),
    (error) => error.statusCode === 400
  );
});
