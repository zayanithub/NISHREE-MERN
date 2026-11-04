import test from "node:test";
import assert from "node:assert/strict";

import ExchangeRequest from "../models/ExchangeRequest.js";
import Inventory from "../models/Inventory.js";
import Order from "../models/Order.js";
import Product from "../models/Product.js";
import ProductReview from "../models/ProductReview.js";
import ReturnRequest from "../models/ReturnRequest.js";
import User from "../models/User.js";
import {
  adminDashboardInternals,
  getAdminDashboardInventoryAlerts,
  getAdminDashboardOverview,
  getAdminDashboardSales,
} from "../service/adminDashboardService.js";
import {
  dashboardInventorySchema,
  dashboardPeriodSchema,
} from "../validations/adminDashboardValidation.js";

const queryWith = (value) => ({
  select() {
    return this;
  },
  sort() {
    return this;
  },
  limit() {
    return this;
  },
  lean: async () => value,
});

test("validates supported dashboard periods and bounded inventory limits", () => {
  assert.equal(dashboardPeriodSchema.safeParse({}).data.period, "30d");
  assert.equal(
    dashboardPeriodSchema.safeParse({ period: "365d" }).success,
    false
  );
  assert.equal(
    dashboardPeriodSchema.safeParse({ period: "7d", extra: "ignored" }).success,
    false
  );
  assert.equal(dashboardInventorySchema.parse({ limit: "50" }).limit, 50);
  assert.equal(
    dashboardInventorySchema.safeParse({ limit: "101" }).success,
    false
  );
});

test("builds inclusive UTC periods and revenue queries include settled orders only", () => {
  const { start, end, days } = adminDashboardInternals.getPeriodBounds(
    "7d",
    new Date("2026-10-17T12:00:00.000Z")
  );
  assert.equal(start.toISOString(), "2026-10-11T00:00:00.000Z");
  assert.equal(end.toISOString(), "2026-10-17T12:00:00.000Z");
  assert.equal(days, 7);

  const match = adminDashboardInternals.eligibleSalesMatch(start, end);
  assert.deepEqual(match.$or, [
    { paymentStatus: { $in: ["paid", "partially_refunded"] } },
    { paymentMethod: "cod", orderStatus: "delivered" },
  ]);
});

test("sales endpoint returns complete daily buckets, settlement totals, and top products", async (t) => {
  const today = new Date().toISOString().slice(0, 10);
  t.mock.method(Order, "aggregate", async (pipeline) => {
    if (pipeline.some((stage) => stage.$unwind)) {
      return [{
        productId: "507f1f77bcf86cd799439019",
        name: "Silk Saree",
        sku: "SAR-01",
        unitsSold: 3,
        sales: 2499,
      }];
    }
    return [
      {
        _id: { day: today, paymentMethod: "razorpay" },
        orderCount: 2,
        revenue: 1999.99,
      },
      {
        _id: { day: today, paymentMethod: "cod" },
        orderCount: 1,
        revenue: 500,
      },
    ];
  });

  const result = await getAdminDashboardSales({ period: "7d" });
  assert.equal(result.currency, "INR");
  assert.equal(result.orderCount, 3);
  assert.equal(result.revenue, 2499.99);
  assert.equal(result.dailySales.length, 7);
  assert.equal(
    result.dailySales.find((day) => day.date === today).orderCount,
    3
  );
  assert.equal(result.paymentMethods.length, 2);
  assert.equal(result.topProducts[0].name, "Silk Saree");
});

test("inventory alert endpoint returns the requested bound and count", async (t) => {
  t.mock.method(Inventory, "aggregate", async (pipeline) => {
    assert.equal(pipeline.at(-1).$facet.items.at(-1).$limit, 10);
    return [{
      items: [{ availableQuantity: 1, lowStockThreshold: 5 }],
      metadata: [{ total: 6 }],
    }];
  });

  const result = await getAdminDashboardInventoryAlerts({ limit: "10" });
  assert.equal(result.total, 6);
  assert.equal(result.limit, 10);
  assert.equal(result.items.length, 1);
});

test("overview combines operational counters and dashboard sales data", async (t) => {
  const today = new Date().toISOString().slice(0, 10);
  t.mock.method(Order, "countDocuments", async () => 12);
  t.mock.method(Order, "aggregate", async (pipeline) => {
    if (pipeline.some((stage) => stage.$unwind)) {
      return [{ name: "Silk Saree", unitsSold: 2, sales: 1200 }];
    }
    if (pipeline.some((stage) => stage.$group?._id === "$orderStatus")) {
      return [{ _id: "delivered", count: 8 }];
    }
    return [{
      _id: { day: today, paymentMethod: "razorpay" },
      orderCount: 2,
      revenue: 1200,
    }];
  });
  t.mock.method(Order, "find", () => queryWith([{ orderNumber: "NIA-1" }]));
  t.mock.method(User, "countDocuments", async () => 4);
  t.mock.method(Product, "countDocuments", async () => 20);
  t.mock.method(ReturnRequest, "countDocuments", async () => 2);
  t.mock.method(ExchangeRequest, "countDocuments", async () => 3);
  t.mock.method(ProductReview, "countDocuments", async () => 1);
  t.mock.method(Inventory, "aggregate", async () => [{
    items: [{ availableQuantity: 2 }],
    metadata: [{ total: 5 }],
  }]);

  const result = await getAdminDashboardOverview({ period: "30d" });
  assert.equal(result.metrics.totalOrders, 12);
  assert.equal(result.metrics.netSales, 1200);
  assert.equal(result.metrics.averageOrderValue, 600);
  assert.equal(result.metrics.newCustomers, 4);
  assert.equal(result.metrics.pendingReturns, 2);
  assert.equal(result.metrics.pendingExchanges, 3);
  assert.equal(result.metrics.pendingReviews, 1);
  assert.equal(result.metrics.lowStockItems, 5);
  assert.equal(result.orderStatusCounts[0].status, "delivered");
  assert.equal(result.lowStockItems.length, 1);
  assert.equal(result.recentOrders[0].orderNumber, "NIA-1");
});

test("invalid dashboard queries fail before database access", async () => {
  await assert.rejects(
    getAdminDashboardSales({ period: "all-time" }),
    { statusCode: 400 }
  );
  await assert.rejects(
    getAdminDashboardInventoryAlerts({ limit: "0" }),
    { statusCode: 400 }
  );
});
