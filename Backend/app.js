import "dotenv/config";

import express from "express";
import cookieParser from "cookie-parser";
import cors from "cors";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import mongoose from "mongoose";

import authRoutes from "./routes/authRoutes.js";
import adminAuthRoutes from "./routes/adminAuthRoutes.js";

import productRoutes from "./routes/productRoutes.js";
import categoryRoutes from "./routes/categoryRoutes.js";
import adminCategoryRoutes from "./routes/admin/categoryRoutes.js";
import adminProductRoutes from "./routes/admin/productRoutes.js";

import productImageRoutes from "./routes/admin/productImageRoutes.js";
import productVariantRoutes from "./routes/admin/productVariantRoutes.js";
import inventoryRoutes from "./routes/admin/inventoryRoutes.js";

import cartRoutes from "./routes/cartRoutes.js";
import wishlistRoutes from "./routes/wishlistRoutes.js";
import addressRoutes from "./routes/addressRoutes.js";

import orderRoutes from "./routes/orderRoutes.js";
import adminOrderRoutes from "./routes/admin/orderRoutes.js";

import paymentRoutes from "./routes/paymentRoutes.js";
import razorpayWebhookRoutes from "./routes/razorpayWebhookRoutes.js";

import adminShippingRoutes from "./routes/admin/adminShippingRoutes.js";

import returnRoutes from "./routes/returnRoutes.js";
import exchangeRoutes from "./routes/exchangeRoutes.js";

import adminReturnRoutes from "./routes/admin/adminReturnRoutes.js";
import adminRefundRoutes from "./routes/admin/adminRefundRoutes.js";

import adminExchangeRoutes from "./routes/admin/adminExchangeRoutes.js";
import reviewRoutes from "./routes/reviewRoutes.js";
import adminReviewRoutes from "./routes/admin/adminReviewRoutes.js";
import couponRoutes from "./routes/couponRoutes.js";
import adminCouponRoutes from "./routes/admin/adminCouponRoutes.js";
import notificationRoutes from "./routes/notificationRoutes.js";
import adminNotificationRoutes from "./routes/admin/adminNotificationRoutes.js";
import adminDashboardRoutes from "./routes/admin/adminDashboardRoutes.js";
import adminCustomerRoutes from "./routes/admin/customerRoutes.js";
import adminStoreSettingsRoutes from "./routes/admin/storeSettingsRoutes.js";
import storeSettingsRoutes from "./routes/storeSettingsRoutes.js";
import chatbotRoutes from "./routes/chatbotRoutes.js";
import adminAuditLogRoutes from "./routes/admin/adminAuditLogRoutes.js";
import notificationDeliveryWebhookRoutes from "./routes/notificationDeliveryWebhookRoutes.js";
import contactRoutes from "./routes/contactRoutes.js";
import homepageImageRoutes from "./routes/homepageImageRoutes.js";
import adminHomepageImageRoutes from "./routes/admin/homepageImageRoutes.js";
import newsletterRoutes from "./routes/newsletterRoutes.js";
import blogPostRoutes from "./routes/blogPostRoutes.js";
import adminBlogPostRoutes from "./routes/admin/blogPostRoutes.js";
import { getSitemap } from "./controllers/seoController.js";

const app = express();

app.set("trust proxy", 1);

app.use(helmet());

const allowedOrigin = process.env.FRONTEND_URL || "http://localhost:5713";

app.use(
  cors({
    origin: allowedOrigin,
    credentials: true,
  }),
);

const healthCheck = (req, res) => {
  const databaseConnected = mongoose.connection.readyState === 1;
  return res.status(databaseConnected ? 200 : 503).json({
    success: databaseConnected,
    message: "Nishree Attire API health check",
    database: databaseConnected ? "Connected" : "Disconnected",
    timestamp: new Date().toISOString(),
  });
};

app.get("/api/health", healthCheck);
app.get("/api/ready", healthCheck);

export const API_RATE_LIMIT = 600;

const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: API_RATE_LIMIT,
  skip: (req) =>
    req.path === "/v1/auth/refresh" ||
    req.path === "/v1/admin/auth/refresh",
  standardHeaders: "draft-8",
  legacyHeaders: false,
  message: {
    success: false,
    message: "Too many requests. Please try again later.",
  },
});

const adminLoginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  message: {
    success: false,
    message: "Too many admin login attempts. Please try again later.",
  },
});

app.use("/api/v1/payments/razorpay/webhook", apiLimiter, razorpayWebhookRoutes);

app.use("/api", apiLimiter);
app.get("/api/seo/sitemap.xml", getSitemap);

app.use(
  express.json({
    limit: "1mb",
    verify: (req, res, buffer) => {
      req.rawBody = Buffer.from(buffer);
    },
  })
);

app.use(
  express.urlencoded({
    extended: true,
    limit: "1mb",
  }),
);

app.use(cookieParser());

app.use("/api/v1/admin/auth/login", adminLoginLimiter);

app.use("/api/v1/auth", authRoutes);

app.use("/api/v1/admin/auth", adminAuthRoutes);

app.use("/api/v1/products", productRoutes);

app.use("/api/v1/categories", categoryRoutes);

app.use("/api/v1/admin/categories", adminCategoryRoutes);

app.use("/api/v1/admin/products", adminProductRoutes);

app.use("/api/v1/admin/products", productImageRoutes);

app.use("/api/v1/admin/products", productVariantRoutes);

app.use("/api/v1/admin/inventory", inventoryRoutes);

app.use("/api/v1/cart", cartRoutes);

app.use("/api/v1/wishlist", wishlistRoutes);

app.use("/api/v1/addresses", addressRoutes);

app.use("/api/v1/orders", orderRoutes);

app.use("/api/v1/admin/orders", adminOrderRoutes);

app.use("/api/v1/admin/returns", adminReturnRoutes);

app.use("/api/v1/admin/exchanges", adminExchangeRoutes);

app.use("/api/v1/admin/refunds", adminRefundRoutes);

app.use("/api/v1/admin/reviews", adminReviewRoutes);

app.use("/api/v1/admin/coupons", adminCouponRoutes);

app.use("/api/v1/notifications", notificationRoutes);

app.use("/api/v1/admin/notifications", adminNotificationRoutes);

app.use("/api/v1/admin/dashboard", adminDashboardRoutes);
app.use("/api/v1/admin/customers", adminCustomerRoutes);
app.use("/api/v1/admin/settings", adminStoreSettingsRoutes);
app.use("/api/v1/admin/homepage-images", adminHomepageImageRoutes);
app.use("/api/v1/homepage-images", homepageImageRoutes);
app.use("/api/v1/settings", storeSettingsRoutes);
app.use("/api/v1/contact", contactRoutes);
app.use("/api/v1/newsletter", newsletterRoutes);
app.use("/api/v1/blogs", blogPostRoutes);
app.use("/api/v1/admin/blogs", adminBlogPostRoutes);
app.use("/api/v1/chatbot", chatbotRoutes);

app.use("/api/v1/admin/audit-logs", adminAuditLogRoutes);

app.use(
  "/api/v1/notification-delivery-webhooks",
  notificationDeliveryWebhookRoutes
);

app.use("/api/v1/returns", returnRoutes);

app.use("/api/v1/exchanges", exchangeRoutes);

app.use("/api/v1/reviews", reviewRoutes);

app.use("/api/v1/coupons", couponRoutes);

app.use("/api/v1/admin/shipping", adminShippingRoutes);

app.use("/api/v1/payments", paymentRoutes);


app.get("/", (req, res) => {
  res.status(200).json({
    success: true,
    message: "Nishree Attire API is running",
  });
});

/*
|--------------------------------------------------------------------------
| Temporary Local Razorpay Testing Page
|--------------------------------------------------------------------------
|
| For local development only.
| Do not expose the testing page in production.
|--------------------------------------------------------------------------
*/
app.use(
  "/testing",
  (req, res, next) => {
    if (process.env.NODE_ENV === "production") {
      return res.status(404).end();
    }

    res.removeHeader("Content-Security-Policy");
    res.removeHeader("Cross-Origin-Opener-Policy");

    return next();
  },
  express.static("testing"),
);
/*
|--------------------------------------------------------------------------
| API 404 Handler
|--------------------------------------------------------------------------
*/
app.use("/api", (req, res) => {
  res.status(404).json({
    success: false,
    message: `API route not found: ${req.method} ${req.originalUrl}`,
  });
});
/*
|--------------------------------------------------------------------------
| Unknown Non-API Routes
|--------------------------------------------------------------------------
*/
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: "Route not found",
  });
});
/*
|--------------------------------------------------------------------------
| Central Error Handler
|--------------------------------------------------------------------------
*/
app.use((err, req, res, next) => {
  if (res.headersSent) {
    return next(err);
  }

  const errorMessage =
    err instanceof Error
      ? err.message || "Error object did not include a message"
      : typeof err === "string"
        ? err
        : "Unknown error value";
  const statusCode = Number.isInteger(err?.statusCode)
    ? err.statusCode
    : null;

  console.error("Request error:", {
    message: errorMessage,
    name: err instanceof Error ? err.name : typeof err,
    code: err?.code,
    statusCode,
    method: req.method,
    path: req.originalUrl,
    requestId: req.get("x-request-id"),
  });

  const responseStatus =
    statusCode >= 400 && statusCode < 600 ? statusCode : 500;

  return res.status(responseStatus).json({
    success: false,
    message:
      responseStatus === 500
        ? "Internal server error"
        : errorMessage,
  });
});

export default app;
