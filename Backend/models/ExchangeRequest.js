import mongoose from "mongoose";

const exchangeRequestSchema = new mongoose.Schema(
  {
    exchangeNumber: {
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

    originalProduct: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Product",
      required: true,
    },

    originalVariant: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "ProductVariant",
      default: null,
    },

    originalProductName: {
      type: String,
      required: true,
      trim: true,
    },

    originalSku: {
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
        message: "Exchange quantity must be a whole number",
      },
    },

    requestedProduct: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Product",
      default: null,
    },

    requestedVariant: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "ProductVariant",
      default: null,
    },

    requestedProductName: {
      type: String,
      default: null,
      trim: true,
    },

    requestedSku: {
      type: String,
      default: null,
      trim: true,
    },

    replacementInventory: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Inventory",
      default: null,
    },

    replacementInventoryReserved: {
      type: Boolean,
      default: false,
    },

    reason: {
      type: String,
      enum: [
        "wrong_product",
        "damaged_product",
        "different_from_description",
        "size_or_fit",
        "color_change",
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

    status: {
      type: String,
      enum: [
        "requested",
        "under_review",
        "approved",
        "rejected",
        "pickup_scheduled",
        "original_in_transit",
        "original_received",
        "inspection_passed",
        "inspection_failed",
        "replacement_pending",
        "replacement_shipped",
        "completed",
        "cancelled",
      ],
      default: "requested",
      index: true,
    },

    originalPickupCarrier: {
      type: String,
      default: null,
      trim: true,
    },

    originalPickupTrackingNumber: {
      type: String,
      default: null,
      trim: true,
    },

    replacementTrackingNumber: {
      type: String,
      default: null,
      trim: true,
    },

    replacementCarrier: {
      type: String,
      default: null,
      trim: true,
    },

    originalReceivedAt: {
      type: Date,
      default: null,
    },

    replacementShippedAt: {
      type: Date,
      default: null,
    },

    completedAt: {
      type: Date,
      default: null,
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

    priceDifference: {
      type: Number,
      default: 0,
    },

    priceDifferenceStatus: {
      type: String,
      enum: ["not_applicable", "pending", "paid", "refunded"],
      default: "not_applicable",
    },

    priceDifferenceReference: {
      type: String,
      default: null,
      trim: true,
      maxlength: 150,
    },

    priceDifferenceSettledAt: {
      type: Date,
      default: null,
    },

    priceDifferenceSettledBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "AdminUser",
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

    requestedAt: {
      type: Date,
      default: Date.now,
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

exchangeRequestSchema.index({ user: 1, createdAt: -1 });
exchangeRequestSchema.index({ order: 1, orderItemId: 1, status: 1 });
exchangeRequestSchema.index({ status: 1, createdAt: -1 });

const ExchangeRequest = mongoose.model(
  "ExchangeRequest",
  exchangeRequestSchema
);

export default ExchangeRequest;