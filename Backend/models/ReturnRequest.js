import mongoose from "mongoose";

const returnRequestSchema = new mongoose.Schema(
  {
    returnNumber: {
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

    orderItemId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
    },

    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
      index: true,
    },

    product: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Product",
      required: true,
    },

    variant: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "ProductVariant",
      default: null,
    },

    productName: {
      type: String,
      required: true,
      trim: true,
    },

    sku: {
      type: String,
      required: true,
      trim: true,
    },

    quantity: {
      type: Number,
      required: true,
      min: 1,
      validate: {
        validator: Number.isInteger,
        message: "Return quantity must be a whole number",
      },
    },

    reason: {
      type: String,
      enum: [
        "damaged_product",
        "wrong_product",
        "different_from_description",
        "quality_issue",
        "size_or_fit",
        "other",
      ],
      required: true,
    },

    reasonDetails: {
      type: String,
      default: "",
      trim: true,
      maxlength: 1500,
    },

    evidenceImages: [
      {
        url: {
          type: String,
          required: true,
        },
        publicId: {
          type: String,
          default: null,
        },
      },
    ],

    status: {
      type: String,
      enum: [
        "requested",
        "under_review",
        "approved",
        "rejected",
        "pickup_scheduled",
        "in_transit",
        "received",
        "inspection_passed",
        "inspection_failed",
        "refund_pending",
        "completed",
        "cancelled",
      ],
      default: "requested",
      index: true,
    },

    requestedAt: {
      type: Date,
      default: Date.now,
    },

    returnDeadline: {
      type: Date,
      default: null,
    },

    approvedAt: {
      type: Date,
      default: null,
    },

    rejectedAt: {
      type: Date,
      default: null,
    },

    receivedAt: {
      type: Date,
      default: null,
    },

    completedAt: {
      type: Date,
      default: null,
    },

    pickupCarrier: {
      type: String,
      default: null,
      trim: true,
    },

    pickupTrackingNumber: {
      type: String,
      default: null,
      trim: true,
    },

    inspectionNotes: {
      type: String,
      default: "",
      maxlength: 1500,
    },

    rejectionReason: {
      type: String,
      default: null,
      maxlength: 1000,
    },

    refund: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Refund",
      default: null,
    },

    reviewedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "AdminUser",
      default: null,
    },

    reviewedAt: {
      type: Date,
      default: null,
    },

    cancelledAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
    versionKey: false,
  }
);

returnRequestSchema.index({ user: 1, createdAt: -1 });
returnRequestSchema.index({ order: 1, orderItemId: 1, status: 1 });
returnRequestSchema.index({ status: 1, createdAt: -1 });

const ReturnRequest = mongoose.model(
  "ReturnRequest",
  returnRequestSchema
);

export default ReturnRequest;