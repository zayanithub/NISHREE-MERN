import mongoose from "mongoose";

const razorpayWebhookEventSchema = new mongoose.Schema(
  {
    eventId: {
      type: String,
      required: true,
      trim: true,
      maxlength: 200,
    },

    eventType: {
      type: String,
      required: true,
      trim: true,
      maxlength: 100,
    },

    razorpayPaymentId: {
      type: String,
      default: null,
      trim: true,
    },

    razorpayOrderId: {
      type: String,
      default: null,
      trim: true,
    },

    status: {
      type: String,
      enum: [
        "received",
        "processing",
        "processed",
        "failed",
      ],
      default: "received",
      required: true,
      index: true,
    },

    signatureVerified: {
      type: Boolean,
      default: false,
    },

    attempts: {
      type: Number,
      default: 0,
      min: 0,
      validate: {
        validator: Number.isInteger,
        message: "Attempts must be a whole number.",
      },
    },

    lastError: {
      type: String,
      default: null,
      maxlength: 1000,
    },

    processedAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
    versionKey: false,
  }
);

// Unique event ID prevents duplicate webhook event records.
razorpayWebhookEventSchema.index(
  { eventId: 1 },
  { unique: true }
);

// Helps investigate events that failed processing.
razorpayWebhookEventSchema.index({
  status: 1,
  createdAt: -1,
});

const RazorpayWebhookEvent = mongoose.model(
  "RazorpayWebhookEvent",
  razorpayWebhookEventSchema
);

export default RazorpayWebhookEvent;