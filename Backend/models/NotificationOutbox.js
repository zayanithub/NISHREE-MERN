import mongoose from "mongoose";

const notificationOutboxSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    eventKey: {
      type: String,
      required: true,
      trim: true,
      maxlength: 200,
    },
    payload: {
      type: mongoose.Schema.Types.Mixed,
      required: true,
    },
    notification: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Notification",
      default: null,
    },
    status: {
      type: String,
      enum: ["pending", "processing", "completed", "failed"],
      default: "pending",
      index: true,
    },
    attempts: {
      type: Number,
      default: 0,
      min: 0,
      validate: Number.isInteger,
    },
    nextAttemptAt: {
      type: Date,
      default: Date.now,
      index: true,
    },
    leaseExpiresAt: {
      type: Date,
      default: null,
      index: true,
    },
    lastError: {
      type: String,
      default: null,
      maxlength: 1000,
    },
    completedAt: {
      type: Date,
      default: null,
    },
  },
  { timestamps: true, versionKey: false }
);

notificationOutboxSchema.index(
  { user: 1, eventKey: 1 },
  { unique: true }
);
notificationOutboxSchema.index({
  status: 1,
  nextAttemptAt: 1,
  leaseExpiresAt: 1,
  createdAt: 1,
});

const NotificationOutbox =
  mongoose.models.NotificationOutbox ||
  mongoose.model("NotificationOutbox", notificationOutboxSchema);

export default NotificationOutbox;
