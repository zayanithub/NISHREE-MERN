import mongoose from "mongoose";

const notificationLogSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
      index: true,
    },
    order: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Order",
      default: null,
    },
    templateKey: {
      type: String,
      trim: true,
      default: null,
    },
    deliveryKey: {
      type: String,
      required: true,
      trim: true,
      maxlength: 250,
    },
    eventType: {
      type: String,
      trim: true,
      default: null,
    },
    channel: {
      type: String,
      enum: ["email", "sms", "whatsapp", "in_app"],
      required: true,
    },
    recipient: {
      type: String,
      required: true,
      trim: true,
    },
    provider: {
      type: String,
      trim: true,
      default: "unknown",
    },
    providerMessageId: {
      type: String,
      default: null,
    },
    status: {
      type: String,
      enum: [
        "queued",
        "sending",
        "sent",
        "delivered",
        "failed",
        "suppressed",
        "uncertain",
      ],
      default: "queued",
      index: true,
    },
    nextAttemptAt: {
      type: Date,
      default: Date.now,
      index: true,
    },
    lastErrorCode: {
      type: String,
      default: null,
      maxlength: 100,
    },
    retryRequestedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "AdminUser",
      default: null,
    },
    attempts: {
      type: Number,
      default: 0,
      min: 0,
      validate: Number.isInteger,
    },
    lastAttemptAt: {
      type: Date,
      default: null,
    },
    sentAt: {
      type: Date,
      default: null,
    },
    deliveredAt: {
      type: Date,
      default: null,
    },
    errorMessage: {
      type: String,
      default: null,
      maxlength: 1000,
    },
    metadata: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
  },
  { timestamps: true, versionKey: false }
);

notificationLogSchema.index({ order: 1, createdAt: -1 });
notificationLogSchema.index({ channel: 1, status: 1, createdAt: -1 });
notificationLogSchema.index(
  { deliveryKey: 1 },
  {
    unique: true,
    partialFilterExpression: {
      deliveryKey: { $type: "string" },
    },
  }
);
notificationLogSchema.index({ status: 1, nextAttemptAt: 1, createdAt: 1 });

const NotificationLog = mongoose.model(
  "NotificationLog",
  notificationLogSchema
);

export default NotificationLog;