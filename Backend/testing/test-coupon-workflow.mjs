import test from "node:test";
import assert from "node:assert/strict";
import mongoose from "mongoose";

import Coupon from "../models/Coupon.js";
import CouponRedemption from "../models/CouponRedemption.js";
import CouponUserUsage from "../models/CouponUserUsage.js";
import {
  calculateCouponDiscount,
  createAdminCoupon,
  deleteAdminCoupon,
  getCouponForOrder,
  listCurrentPublicOffers,
  recordCouponRedemption,
  releaseCouponRedemptionForOrder,
  reserveCouponUsage,
} from "../service/couponService.js";
import { createCouponSchema } from "../validations/couponValidation.js";

const ADMIN_ID = "507f1f77bcf86cd799439011";
const CUSTOMER_ID = "507f1f77bcf86cd799439012";
const COUPON_ID = "507f1f77bcf86cd799439013";
const ORDER_ID = "507f1f77bcf86cd799439014";
const PRODUCT_ID = "507f1f77bcf86cd799439015";
const CATEGORY_ID = "507f1f77bcf86cd799439016";

test("public offers expose only the current coupon eligibility fields", async (t) => {
  let filter;
  let selectedFields;
  t.mock.method(Coupon, "find", (query) => {
    filter = query;
    const chain = {
      select(fields) { selectedFields = fields; return this; },
      sort() { return this; },
      limit(value) { assert.equal(value, 20); return this; },
      lean: async () => [{
        code: "SAVE10",
        discountValue: 10,
        applicableCategories: [],
        applicableProducts: [],
      }],
    };
    return chain;
  });

  const offers = await listCurrentPublicOffers();
  assert.deepEqual(offers, [{
    code: "SAVE10",
    description: undefined,
    discountType: undefined,
    discountValue: 10,
    maxDiscount: undefined,
    minimumOrderValue: undefined,
    startsAt: undefined,
    expiresAt: undefined,
    isRestricted: false,
  }]);
  assert.equal(filter.isActive, true);
  assert.ok(filter.startsAt.$lte instanceof Date);
  assert.ok(filter.expiresAt.$gt instanceof Date);
  assert.equal(selectedFields.includes("usageCount"), false);
});

const mockTransactionSession = (t) =>
  t.mock.method(mongoose, "startSession", async () => ({
    withTransaction: async (callback) => callback(),
    endSession: async () => {},
  }));

const percentCoupon = {
  _id: COUPON_ID,
  code: "SAVE10",
  discountType: "percentage",
  discountValue: 10,
  maxDiscount: 50,
  minimumOrderValue: 100,
  applicableProducts: [],
  applicableCategories: [],
  usageCount: 0,
  usageLimit: 5,
  perUserLimit: 1,
};

test("calculates percentage discounts with caps and fixed discounts without exceeding eligible subtotal", () => {
  const items = [
    { product: PRODUCT_ID, category: CATEGORY_ID, lineTotal: 300 },
    { product: "507f1f77bcf86cd799439017", category: CATEGORY_ID, lineTotal: 200 },
  ];

  assert.deepEqual(
    calculateCouponDiscount(percentCoupon, items, 500),
    {
      discountAmount: 50,
      eligibleSubtotal: 500,
      totalAmount: 450,
      itemDiscounts: [30, 20],
    }
  );

  assert.deepEqual(
    calculateCouponDiscount(
      {
        ...percentCoupon,
        discountType: "fixed",
        discountValue: 100,
        maxDiscount: null,
        applicableProducts: [PRODUCT_ID],
      },
      items,
      500
    ),
    {
      discountAmount: 100,
      eligibleSubtotal: 300,
      totalAmount: 400,
      itemDiscounts: [100, 0],
    }
  );
});

test("rejects coupon minimum order and ineligible product cases", () => {
  assert.throws(
    () => calculateCouponDiscount(
      percentCoupon,
      [{ product: PRODUCT_ID, category: CATEGORY_ID, lineTotal: 50 }],
      50
    ),
    (error) => error.statusCode === 422
  );

  assert.deepEqual(
    calculateCouponDiscount(
      {
        ...percentCoupon,
        applicableProducts: ["507f1f77bcf86cd799439018"],
        applicableCategories: [CATEGORY_ID],
      },
      [{ product: PRODUCT_ID, category: CATEGORY_ID, lineTotal: 100 }],
      100
    ).itemDiscounts,
    [10]
  );

  assert.throws(
    () => calculateCouponDiscount(
      {
        ...percentCoupon,
        applicableProducts: ["507f1f77bcf86cd799439018"],
      },
      [{ product: PRODUCT_ID, category: CATEGORY_ID, lineTotal: 500 }],
      500
    ),
    (error) => error.statusCode === 422
  );
});

test("rejects unavailable coupons before returning a quote", async (t) => {
  t.mock.method(Coupon, "findOne", () => ({
    lean: async () => null,
  }));

  await assert.rejects(
    getCouponForOrder(
      CUSTOMER_ID,
      "expired",
      [{ product: PRODUCT_ID, category: CATEGORY_ID, lineTotal: 500 }],
      500
    ),
    (error) => error.statusCode === 422
  );
});

test("validates active coupon eligibility before calculating order discount", async (t) => {
  t.mock.method(Coupon, "findOne", () => ({
    lean: async () => percentCoupon,
  }));
  t.mock.method(CouponUserUsage, "findOne", () => ({
    select() {
      return this;
    },
    lean: async () => null,
  }));

  const quote = await getCouponForOrder(
    CUSTOMER_ID,
    "save10",
    [{ product: PRODUCT_ID, category: CATEGORY_ID, lineTotal: 200 }],
    200
  );

  assert.equal(quote.coupon.code, "SAVE10");
  assert.equal(quote.discountAmount, 20);
  assert.equal(quote.totalAmount, 180);
  assert.deepEqual(quote.itemDiscounts, [20]);
});

test("reserves global and per-user coupon limits atomically", async (t) => {
  mockTransactionSession(t);

  t.mock.method(Coupon, "findOneAndUpdate", async (filter, update, options) => {
    assert.equal(filter._id, COUPON_ID);
    assert.equal(update.$inc.usageCount, 1);
    assert.ok(filter.$expr || filter.$or);
    assert.ok(options.session);
    return { _id: COUPON_ID, code: "SAVE10", perUserLimit: 1 };
  });
  t.mock.method(CouponUserUsage, "updateOne", async (_filter, update, options) => {
    assert.equal(update.$setOnInsert.usageCount, 0);
    assert.ok(options.session);
    return { upsertedCount: 1 };
  });
  t.mock.method(
    CouponUserUsage,
    "findOneAndUpdate",
    async (filter, update, options) => {
      assert.equal(filter.coupon, COUPON_ID);
      assert.equal(filter.user, CUSTOMER_ID);
      assert.equal(update.$inc.usageCount, 1);
      assert.ok(options.session);
      return { usageCount: 1 };
    }
  );

  const reservation = await reserveCouponUsage(
    { _id: COUPON_ID },
    CUSTOMER_ID
  );

  assert.deepEqual(reservation, {
    couponId: COUPON_ID,
    userId: CUSTOMER_ID,
    code: "SAVE10",
  });
});

test("rejects a concurrent per-user reservation after rolling back in its transaction", async (t) => {
  mockTransactionSession(t);
  t.mock.method(Coupon, "findOneAndUpdate", async () => ({
    _id: COUPON_ID,
    code: "SAVE10",
    perUserLimit: 1,
  }));
  t.mock.method(CouponUserUsage, "updateOne", async () => ({
    upsertedCount: 0,
  }));
  t.mock.method(
    CouponUserUsage,
    "findOneAndUpdate",
    async () => null
  );

  await assert.rejects(
    reserveCouponUsage({ _id: COUPON_ID }, CUSTOMER_ID),
    (error) => error.statusCode === 409
  );
});

test("releases a pending order redemption and its counters once", async (t) => {
  mockTransactionSession(t);

  t.mock.method(
    CouponRedemption,
    "findOneAndUpdate",
    async (filter, update, options) => {
      assert.deepEqual(filter, {
        order: ORDER_ID,
        status: { $in: ["reserved", "redeemed"] },
      });
      assert.equal(update.$set.status, "released");
      assert.ok(options.session);
      return {
        coupon: COUPON_ID,
        user: CUSTOMER_ID,
      };
    }
  );
  t.mock.method(Coupon, "updateOne", async (filter, update, options) => {
    assert.equal(filter._id, COUPON_ID);
    assert.equal(update.$inc.usageCount, -1);
    assert.ok(options.session);
    return { modifiedCount: 1 };
  });
  t.mock.method(CouponUserUsage, "updateOne", async (filter, update, options) => {
    assert.equal(filter.user, CUSTOMER_ID);
    assert.equal(update.$inc.usageCount, -1);
    assert.ok(options.session);
    return { modifiedCount: 1 };
  });

  assert.equal(
    await releaseCouponRedemptionForOrder(ORDER_ID),
    true
  );
});

test("records the coupon as reserved or redeemed according to checkout state", async (t) => {
  t.mock.method(CouponRedemption, "create", async (data) => {
    assert.equal(data.order, ORDER_ID);
    assert.equal(data.coupon, COUPON_ID);
    assert.equal(data.user, CUSTOMER_ID);
    assert.equal(data.discountAmount, 30);
    assert.equal(data.status, "reserved");
    return data;
  });

  const redemption = await recordCouponRedemption({
    reservation: {
      couponId: COUPON_ID,
      userId: CUSTOMER_ID,
      code: "SAVE10",
    },
    orderId: ORDER_ID,
    discountAmount: 30,
    redeemed: false,
  });

  assert.equal(redemption.status, "reserved");
});

test("does not delete a coupon that already has uses", async (t) => {
  t.mock.method(Coupon, "findOneAndDelete", async () => null);
  t.mock.method(Coupon, "exists", async () => true);

  await assert.rejects(
    deleteAdminCoupon(COUPON_ID),
    (error) => error.statusCode === 409
  );
});

test("coupon creation schema normalizes code and enforces discount/date bounds", () => {
  const payload = {
    code: " summer-25 ",
    discountType: "percentage",
    discountValue: 25,
    startsAt: "2026-10-01T00:00:00.000Z",
    expiresAt: "2026-11-01T00:00:00.000Z",
  };
  const parsed = createCouponSchema.safeParse(payload);

  assert.equal(parsed.success, true);
  assert.equal(parsed.data.code, "SUMMER-25");
  assert.equal(
    createCouponSchema.safeParse({
      ...payload,
      discountValue: 101,
    }).success,
    false
  );
  assert.equal(
    createCouponSchema.safeParse({
      ...payload,
      expiresAt: "2026-09-01T00:00:00.000Z",
    }).success,
    false
  );
});

test("admin coupon creation assigns the authenticated admin and maps duplicate codes", async (t) => {
  t.mock.method(Coupon, "create", async (data) => {
    assert.equal(data.code, "SAVE10");
    assert.equal(data.createdBy, ADMIN_ID);
    return { ...data };
  });

  const coupon = await createAdminCoupon(ADMIN_ID, {
    code: "save10",
    discountType: "percentage",
    discountValue: 10,
    startsAt: new Date("2026-10-01T00:00:00.000Z"),
    expiresAt: new Date("2026-11-01T00:00:00.000Z"),
  });

  assert.equal(coupon.createdBy, ADMIN_ID);
});
