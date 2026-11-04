import mongoose from "mongoose";

const couponUserUsageSchema = new mongoose.Schema(
  {
    coupon: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Coupon",
      required: true,
    },
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    usageCount: {
      type: Number,
      default: 0,
      min: 0,
    },
  },
  {
    timestamps: true,
    versionKey: false,
  }
);

couponUserUsageSchema.index(
  { coupon: 1, user: 1 },
  { unique: true }
);

const CouponUserUsage = mongoose.model(
  "CouponUserUsage",
  couponUserUsageSchema
);

export default CouponUserUsage;
