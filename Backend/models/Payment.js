import mongoose from "mongoose";

const paymentSchema = new mongoose.Schema(
  {
    order: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Order",
      required: true,
      index: true,
    },

    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
      index: true,
    },

    paymentMethod: {
      type: String,
      enum: ["razorpay", "cod"],
      required: true,
    },

    paymentProvider: {
      type: String,
      enum: ["razorpay", "cod"],
      required: true,
    },

    amount: {
      type: Number,
      required: true,
      min: 0,
    },

    currency: {
      type: String,
      enum: ["INR"],
      default: "INR",
    },

    status: {
      type: String,
      enum: [
        "created",
        "pending",
        "authorized",
        "captured",
        "failed",
        "cancelled",
        "partially_refunded",
        "refunded",
      ],
      default: "created",
      index: true,
    },

    razorpayOrderId: {
      type: String,
      default: undefined,
      trim: true,
    },

    razorpayPaymentId: {
      type: String,
      default: undefined,
      trim: true,
    },

    razorpaySignature: {
      type: String,
      default: undefined,
      select: false,
    },

    signatureVerified: {
      type: Boolean,
      default: false,
    },

    paidAt: {
      type: Date,
      default: null,
    },

    failedAt: {
      type: Date,
      default: null,
    },

    failureCode: {
      type: String,
      default: null,
    },

    failureMessage: {
      type: String,
      default: null,
      maxlength: 500,
    },

    refundAmount: {
      type: Number,
      default: 0,
      min: 0,
    },

    refundReservedAmount: {
      type: Number,
      default: 0,
      min: 0,
    },

    idempotencyKey: {
      type: String,
      default: undefined,
      select: false,
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

// Allow multiple payment attempts for the same order.
// A gateway order ID must be unique when present.
paymentSchema.index(
  { razorpayOrderId: 1 },
  {
    unique: true,
    partialFilterExpression: {
      razorpayOrderId: { $type: "string" },
    },
  }
);

// Prevent the same Razorpay payment from being recorded twice.
paymentSchema.index(
  { razorpayPaymentId: 1 },
  {
    unique: true,
    partialFilterExpression: {
      razorpayPaymentId: { $type: "string" },
    },
  }
);

// Prevent duplicate processing for the same idempotency key.
paymentSchema.index(
  { idempotencyKey: 1 },
  {
    unique: true,
    partialFilterExpression: {
      idempotencyKey: { $type: "string" },
    },
  }
);

paymentSchema.index({ order: 1, createdAt: -1 });

const Payment = mongoose.model("Payment", paymentSchema);

export default Payment;