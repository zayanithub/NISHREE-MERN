import mongoose from "mongoose";

const notificationSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
      index: true,
    },
    adminUser: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "AdminUser",
      default: null,
    },
    type: {
      type: String,
      enum: [
        "order",
        "payment",
        "shipping",
        "refund",
        "return",
        "exchange",
        "promotion",
        "system",
      ],
      required: true,
    },
    title: {
      type: String,
      required: true,
      trim: true,
      maxlength: 150,
    },
    message: {
      type: String,
      required: true,
      trim: true,
      maxlength: 2000,
    },
    relatedOrder: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Order",
      default: null,
    },
    relatedProduct: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Product",
      default: null,
    },
    actionUrl: {
      type: String,
      default: null,
      maxlength: 500,
      validate: {
        validator(value) {
          return (
            value == null ||
            (typeof value === "string" &&
              value.startsWith("/") &&
              !value.startsWith("//") &&
              !value.includes("\\") &&
              !/%2f/i.test(value) &&
              !/[\r\n]/.test(value))
          );
        },
        message: "Notification action URL must be an internal path",
      },
    },
    idempotencyKey: {
      type: String,
      trim: true,
      maxlength: 200,
      default: undefined,
    },
    isRead: {
      type: Boolean,
      default: false,
    },
    readAt: {
      type: Date,
      default: null,
    },
    metadata: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
  },
  { timestamps: true, versionKey: false }
);

notificationSchema.index({ user: 1, isRead: 1, createdAt: -1 });
notificationSchema.index({ adminUser: 1, createdAt: -1 });
notificationSchema.index({
  adminUser: 1,
  isRead: 1,
  createdAt: -1,
});
notificationSchema.index(
  { idempotencyKey: 1 },
  {
    unique: true,
    partialFilterExpression: {
      idempotencyKey: { $type: "string" },
    },
  }
);
notificationSchema.pre("validate", function () {
  const hasUser = Boolean(this.user);
  const hasAdmin = Boolean(this.adminUser);

  if (hasUser === hasAdmin) {
    this.invalidate(
      "user",
      "A notification must have exactly one customer or admin recipient"
    );
  }
});

const Notification = mongoose.model(
  "Notification",
  notificationSchema
);

export default Notification;