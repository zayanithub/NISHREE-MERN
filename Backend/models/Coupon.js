import mongoose from "mongoose";

const couponSchema = new mongoose.Schema(
  {
    code: {
      type: String,
      required: true,
      unique: true,
      uppercase: true,
      trim: true,
      maxlength: 50,
      match: [
        /^[A-Z0-9][A-Z0-9_-]*$/,
        "Coupon code contains unsupported characters",
      ],
    },

    description: {
      type: String,
      trim: true,
      maxlength: 500,
      default: "",
    },

    discountType: {
      type: String,
      enum: ["percentage", "fixed"],
      required: true,
    },

    discountValue: {
      type: Number,
      required: true,
      min: 0.01,
    },

    maxDiscount: {
      type: Number,
      default: null,
      min: 0,
    },

    minimumOrderValue: {
      type: Number,
      default: 0,
      min: 0,
    },

    startsAt: {
      type: Date,
      required: true,
    },

    expiresAt: {
      type: Date,
      required: true,
    },

    usageLimit: {
      type: Number,
      default: null,
      min: 1,
    },

    usageCount: {
      type: Number,
      default: 0,
      min: 0,
    },

    perUserLimit: {
      type: Number,
      default: 1,
      min: 1,
    },

    applicableCategories: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Category",
      },
    ],

    applicableProducts: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Product",
      },
    ],

    isActive: {
      type: Boolean,
      default: true,
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

couponSchema.pre("validate", function () {
  if (
    this.discountType === "percentage" &&
    this.discountValue > 100
  ) {
    this.invalidate(
      "discountValue",
      "Percentage discount cannot exceed 100"
    );
  }

  if (
    this.discountType === "fixed" &&
    this.maxDiscount != null
  ) {
    this.invalidate(
      "maxDiscount",
      "Maximum discount applies only to percentage coupons"
    );
  }

  if (
    this.discountType === "percentage" &&
    this.discountValue > 0 &&
    this.discountValue <= 100 &&
    this.maxDiscount === 0
  ) {
    this.invalidate(
      "maxDiscount",
      "Maximum discount must be greater than zero"
    );
  }

  if (
    this.startsAt &&
    this.expiresAt &&
    this.expiresAt <= this.startsAt
  ) {
    this.invalidate(
      "expiresAt",
      "Coupon expiry must be later than its start time"
    );
  }
});

couponSchema.index({ isActive: 1, startsAt: 1, expiresAt: 1 });

const Coupon = mongoose.model("Coupon", couponSchema);

export default Coupon;