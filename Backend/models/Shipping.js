import mongoose from "mongoose";

const shippingSchema = new mongoose.Schema(
  {
    order: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Order",
      required: true,
    },

    carrier: {
      type: String,
      trim: true,
      default: null,
    },

    serviceType: {
      type: String,
      enum: ["standard", "express", "same_day", "other"],
      default: "standard",
    },

    trackingNumber: {
      type: String,
      trim: true,
      default: undefined,
    },

    trackingUrl: {
      type: String,
      trim: true,
      default: null,
    },

    status: {
      type: String,
      enum: [
        "pending",
        "ready_to_ship",
        "shipped",
        "in_transit",
        "out_for_delivery",
        "delivered",
        "delivery_failed",
        "returned_to_sender",
        "cancelled",
      ],
      default: "pending",
      index: true,
    },

    shippingAddress: {
      fullName: {
        type: String,
        required: true,
        trim: true,
      },

      phone: {
        type: String,
        required: true,
        trim: true,
      },

      addressLine1: {
        type: String,
        required: true,
        trim: true,
      },

      addressLine2: {
        type: String,
        default: "",
      },

      landmark: {
        type: String,
        default: "",
      },

      city: {
        type: String,
        required: true,
        trim: true,
      },

      state: {
        type: String,
        required: true,
        trim: true,
      },

      postalCode: {
        type: String,
        required: true,
        trim: true,
      },

      country: {
        type: String,
        default: "India",
        trim: true,
      },
    },

    shippingCost: {
      type: Number,
      default: 0,
      min: 0,
    },

    estimatedDeliveryAt: {
      type: Date,
      default: null,
    },

    shippedAt: {
      type: Date,
      default: null,
    },

    deliveredAt: {
      type: Date,
      default: null,
    },

    deliveryAttempts: {
      type: Number,
      default: 0,
      min: 0,
      validate: {
        validator: Number.isInteger,
        message: "Delivery attempts must be a whole number",
      },
    },

    lastTrackingUpdateAt: {
      type: Date,
      default: null,
    },

    deliveryNotes: {
      type: String,
      default: "",
      maxlength: 1000,
    },

    failureReason: {
      type: String,
      default: null,
      maxlength: 500,
    },

    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "AdminUser",
      default: null,
    },
  },
  {
    timestamps: true,
    versionKey: false,
  }
);

// One shipping record per order for the initial store workflow.
shippingSchema.index({ order: 1 }, { unique: true });

shippingSchema.index({ status: 1, createdAt: -1 });

shippingSchema.index({ trackingNumber: 1 });

const Shipping = mongoose.model("Shipping", shippingSchema);

export default Shipping;