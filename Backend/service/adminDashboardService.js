import ExchangeRequest from "../models/ExchangeRequest.js";
import Inventory from "../models/Inventory.js";
import Order from "../models/Order.js";
import Payment from "../models/Payment.js";
import Product from "../models/Product.js";
import ProductReview from "../models/ProductReview.js";
import ReturnRequest from "../models/ReturnRequest.js";
import User from "../models/User.js";
import {
  dashboardInventorySchema,
  dashboardPeriodSchema,
} from "../validations/adminDashboardValidation.js";

const createError = (message, statusCode = 400) => {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
};

const roundMoney = (amount) =>
  Math.round((Number(amount) + Number.EPSILON) * 100) / 100;

const parseQuery = (schema, query) => {
  const parsed = schema.safeParse(query);
  if (!parsed.success) {
    throw createError(
      parsed.error.issues.map((issue) => issue.message).join("; ")
    );
  }
  return parsed.data;
};

const getPeriodBounds = (period, now = new Date()) => {
  const days = Number(period.slice(0, -1));
  const end = new Date(now);
  const start = new Date(end);
  start.setUTCHours(0, 0, 0, 0);
  start.setUTCDate(start.getUTCDate() - days + 1);
  return { start, end, days };
};

const eligibleSalesMatch = (start, end) => ({
  createdAt: { $gte: start, $lte: end },
  $or: [
    { paymentStatus: { $in: ["paid", "partially_refunded"] } },
    { paymentMethod: "cod", orderStatus: "delivered" },
  ],
});

const salesPipeline = (start, end) => [
  { $match: eligibleSalesMatch(start, end) },
  {
    $lookup: {
      from: Payment.collection.name,
      localField: "_id",
      foreignField: "order",
      as: "paymentRecords",
    },
  },
  {
    $addFields: {
      paymentRefundTotal: {
        $sum: {
          $map: {
            input: "$paymentRecords",
            as: "payment",
            in: { $ifNull: ["$$payment.refundAmount", 0] },
          },
        },
      },
    },
  },
  {
    $addFields: {
      netRevenue: {
        $max: [
          0,
          {
            $subtract: [
              "$totalAmount",
              {
                $cond: [
                  { $eq: ["$paymentMethod", "cod"] },
                  { $ifNull: ["$manualRefundAmount", 0] },
                  "$paymentRefundTotal",
                ],
              },
            ],
          },
        ],
      },
    },
  },
];

const getSalesData = async (start, end) => {
  const rows = await Order.aggregate([
    ...salesPipeline(start, end),
    {
      $group: {
        _id: {
          day: {
            $dateToString: {
              format: "%Y-%m-%d",
              date: "$createdAt",
              timezone: "UTC",
            },
          },
          paymentMethod: "$paymentMethod",
        },
        orderCount: { $sum: 1 },
        revenue: { $sum: "$netRevenue" },
      },
    },
    { $sort: { "_id.day": 1, "_id.paymentMethod": 1 } },
  ]);
  return rows;
};

const getSalesTotals = (rows, start, days) => {
  const byDay = new Map();
  const byPaymentMethod = new Map();
  let orderCount = 0;
  let revenue = 0;

  for (const row of rows) {
    const day = row._id.day;
    const paymentMethod = row._id.paymentMethod;
    const dayEntry = byDay.get(day) || {
      date: day,
      orderCount: 0,
      revenue: 0,
    };
    dayEntry.orderCount += row.orderCount;
    dayEntry.revenue += row.revenue;
    byDay.set(day, dayEntry);

    const methodEntry = byPaymentMethod.get(paymentMethod) || {
      paymentMethod,
      orderCount: 0,
      revenue: 0,
    };
    methodEntry.orderCount += row.orderCount;
    methodEntry.revenue += row.revenue;
    byPaymentMethod.set(paymentMethod, methodEntry);

    orderCount += row.orderCount;
    revenue += row.revenue;
  }

  const dailySales = Array.from({ length: days }, (_, index) => {
    const date = new Date(start);
    date.setUTCDate(start.getUTCDate() + index);
    const key = date.toISOString().slice(0, 10);
    return byDay.get(key) || { date: key, orderCount: 0, revenue: 0 };
  });

  return {
    orderCount,
    revenue: roundMoney(revenue),
    dailySales: dailySales.map((day) => ({
      ...day,
      revenue: roundMoney(day.revenue),
    })),
    paymentMethods: [...byPaymentMethod.values()]
      .sort((a, b) => a.paymentMethod.localeCompare(b.paymentMethod))
      .map((method) => ({
        ...method,
        revenue: roundMoney(method.revenue),
      })),
  };
};

const getTopProducts = async (start, end) =>
  Order.aggregate([
    { $match: eligibleSalesMatch(start, end) },
    { $unwind: "$items" },
    {
      $group: {
        _id: {
          product: "$items.product",
          name: "$items.productName",
          sku: "$items.sku",
        },
        unitsSold: { $sum: "$items.quantity" },
        sales: { $sum: "$items.lineTotal" },
      },
    },
    { $sort: { unitsSold: -1, sales: -1, "_id.sku": 1 } },
    { $limit: 5 },
    {
      $project: {
        _id: 0,
        productId: "$_id.product",
        name: "$_id.name",
        sku: "$_id.sku",
        unitsSold: 1,
        sales: { $round: ["$sales", 2] },
      },
    },
  ]);

const lowStockPipeline = (limit) => [
  {
    $addFields: {
      availableQuantity: {
        $subtract: ["$quantity", "$reservedQuantity"],
      },
    },
  },
  {
    $match: {
      $expr: { $lte: ["$availableQuantity", "$lowStockThreshold"] },
    },
  },
  {
    $lookup: {
      from: Product.collection.name,
      localField: "product",
      foreignField: "_id",
      as: "product",
    },
  },
  { $unwind: "$product" },
  { $match: { "product.status": "active" } },
  {
    $lookup: {
      from: "productvariants",
      localField: "variant",
      foreignField: "_id",
      as: "variant",
    },
  },
  {
    $match: {
      $or: [
        { inventoryType: "product" },
        { "variant.0.isActive": true },
      ],
    },
  },
  {
    $project: {
      _id: 1,
      inventoryType: 1,
      quantity: 1,
      reservedQuantity: 1,
      availableQuantity: 1,
      lowStockThreshold: 1,
      product: {
        _id: "$product._id",
        name: "$product.name",
        sku: "$product.sku",
      },
      variant: {
        $let: {
          vars: { item: { $arrayElemAt: ["$variant", 0] } },
          in: {
            _id: "$$item._id",
            sku: "$$item.sku",
            name: "$$item.name",
          },
        },
      },
    },
  },
  {
    $facet: {
      items: [
        { $sort: { availableQuantity: 1, "product.name": 1 } },
        { $limit: limit },
      ],
      metadata: [{ $count: "total" }],
    },
  },
];

export const getAdminDashboardSales = async (query = {}) => {
  const { period } = parseQuery(dashboardPeriodSchema, query);
  const { start, end, days } = getPeriodBounds(period);
  const [rows, topProducts] = await Promise.all([
    getSalesData(start, end),
    getTopProducts(start, end),
  ]);

  return {
    period,
    startDate: start.toISOString(),
    endDate: end.toISOString(),
    currency: "INR",
    ...getSalesTotals(rows, start, days),
    topProducts,
  };
};

export const getAdminDashboardInventoryAlerts = async (query = {}) => {
  const { limit } = parseQuery(dashboardInventorySchema, query);
  const [result = { items: [], metadata: [] }] = await Inventory.aggregate(
    lowStockPipeline(limit)
  );
  return {
    items: result.items,
    total: result.metadata[0]?.total ?? 0,
    limit,
  };
};

export const getAdminDashboardOverview = async (query = {}) => {
  const { period } = parseQuery(dashboardPeriodSchema, query);
  const { start, end, days } = getPeriodBounds(period);
  const openReturnStatuses = [
    "requested",
    "under_review",
    "approved",
    "pickup_scheduled",
    "in_transit",
    "received",
    "inspection_passed",
    "refund_pending",
  ];
  const openExchangeStatuses = [
    "requested",
    "under_review",
    "approved",
    "pickup_scheduled",
    "original_in_transit",
    "original_received",
    "inspection_passed",
    "replacement_pending",
  ];

  const [
    orderCount,
    orderStatusRows,
    salesRows,
    topProducts,
    newCustomers,
    activeProducts,
    totalProducts,
    totalCustomers,
    allTimeOrders,
    completedOrders,
    pendingOrders,
    pendingReturns,
    pendingExchanges,
    pendingReviews,
    inventory,
    recentOrders,
  ] = await Promise.all([
    Order.countDocuments({ createdAt: { $gte: start, $lte: end } }),
    Order.aggregate([
      { $match: { createdAt: { $gte: start, $lte: end } } },
      { $group: { _id: "$orderStatus", count: { $sum: 1 } } },
      { $sort: { _id: 1 } },
    ]),
    getSalesData(start, end),
    getTopProducts(start, end),
    User.countDocuments({ createdAt: { $gte: start, $lte: end } }),
    Product.countDocuments({ status: "active" }),
    Product.countDocuments({}),
    User.countDocuments({}),
    Order.countDocuments({}),
    Order.countDocuments({ orderStatus: "delivered" }),
    Order.countDocuments({
      orderStatus: { $in: ["pending_payment", "confirmed", "processing"] },
    }),
    ReturnRequest.countDocuments({ status: { $in: openReturnStatuses } }),
    ExchangeRequest.countDocuments({ status: { $in: openExchangeStatuses } }),
    ProductReview.countDocuments({ status: "pending" }),
    Inventory.aggregate(lowStockPipeline(5)),
    Order.find({})
      .select(
        "orderNumber customerName customerEmail totalAmount currency paymentMethod paymentStatus orderStatus createdAt"
      )
      .sort({ createdAt: -1 })
      .limit(5)
      .lean(),
  ]);
  const sales = getSalesTotals(salesRows, start, days);
  const inventoryResult = inventory[0] || { items: [], metadata: [] };

  return {
    period,
    startDate: start.toISOString(),
    endDate: end.toISOString(),
    currency: "INR",
    metrics: {
      totalOrders: orderCount,
      ordersInPeriod: orderCount,
      allTimeOrders,
      totalProducts,
      totalCustomers,
      completedOrders,
      netSales: sales.revenue,
      averageOrderValue:
        sales.orderCount === 0
          ? 0
          : roundMoney(sales.revenue / sales.orderCount),
      newCustomers,
      activeProducts,
      pendingOrders,
      pendingReturns,
      pendingExchanges,
      pendingReviews,
      lowStockItems: inventoryResult.metadata[0]?.total ?? 0,
    },
    orderStatusCounts: orderStatusRows.map(({ _id, count }) => ({
      status: _id,
      count,
    })),
    dailySales: sales.dailySales,
    paymentMethods: sales.paymentMethods,
    topProducts,
    lowStockItems: inventoryResult.items,
    recentOrders,
  };
};

export const adminDashboardInternals = {
  getPeriodBounds,
  eligibleSalesMatch,
  salesPipeline,
  lowStockPipeline,
  getSalesTotals,
};
