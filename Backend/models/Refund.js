import mongoose from "mongoose";

const refundSchema = new mongoose.Schema(
  {
    refundNumber: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },

    order: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Order",
      required: true,
      index: true,
    },

    payment: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Payment",
      default: null,
      required: function () {
        return this.refundMethod === "original_payment";
      },
      index: true,
    },

    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
      index: true,
    },

    refundType: {
      type: String,
      enum: ["full", "partial"],
      required: true,
    },

    reason: {
      type: String,
      enum: [
        "order_cancelled",
        "product_return",
        "damaged_product",
        "wrong_product",
        "payment_duplicate",
        "payment_failure",
        "other",
      ],
      required: true,
    },

    reasonDetails: {
      type: String,
      default: "",
      maxlength: 1000,
      trim: true,
    },

    amount: {
      type: Number,
      required: true,
      min: 0.01,
    },

    currency: {
      type: String,
      enum: ["INR"],
      default: "INR",
    },

    status: {
      type: String,
      enum: [
        "requested",
        "approved",
        "processing",
        "processed",
        "rejected",
        "failed",
        "cancelled",
      ],
      default: "requested",
      index: true,
    },

    refundMethod: {
      type: String,
      enum: ["original_payment", "manual"],
      default: "original_payment",
    },

    razorpayRefundId: {
      type: String,
      default: undefined,
      trim: true,
    },

    manualPayoutMethod: {
      type: String,
      enum: ["bank_transfer", "upi", "cash", "other"],
      default: null,
    },

    manualPayoutReference: {
      type: String,
      default: undefined,
      trim: true,
      maxlength: 150,
    },

    requestedAt: {
      type: Date,
      default: Date.now,
    },

    approvedAt: {
      type: Date,
      default: null,
    },

    processedAt: {
      type: Date,
      default: null,
    },

    rejectedAt: {
      type: Date,
      default: null,
    },

    rejectedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "AdminUser",
      default: null,
    },

    rejectionReason: {
      type: String,
      default: null,
      maxlength: 500,
      trim: true,
    },

    failureReason: {
      type: String,
      default: null,
      maxlength: 500,
    },

    idempotencyKey: {
      type: String,
      default: undefined,
      select: false,
    },

    processedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "AdminUser",
      default: null,
    },

    metadata: {
      type: mongoose.Schema.Types.Mixed,
      default: undefined,
    },
  },
  {
    timestamps: true,
    versionKey: false,
  }
);

// Avoid recording the same gateway refund more than once.
refundSchema.index(
  { razorpayRefundId: 1 },
  {
    unique: true,
    partialFilterExpression: {
      razorpayRefundId: { $type: "string" },
    },
  }
);

// Prevent duplicate refund requests when the same key is retried.
refundSchema.index(
  { idempotencyKey: 1 },
  {
    unique: true,
    partialFilterExpression: {
      idempotencyKey: { $type: "string" },
    },
  }
);

refundSchema.index(
  { manualPayoutReference: 1 },
  {
    unique: true,
    partialFilterExpression: {
      manualPayoutReference: { $type: "string" },
    },
  }
);

refundSchema.index({ order: 1, createdAt: -1 });
refundSchema.index({ payment: 1, status: 1 });

const Refund = mongoose.model("Refund", refundSchema);

export default Refund;