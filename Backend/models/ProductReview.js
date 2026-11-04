import mongoose from "mongoose";

const productReviewSchema = new mongoose.Schema(
  {
    product: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Product",
      required: true,
      index: true,
    },

    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },

    order: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Order",
      default: null,
    },

    rating: {
      type: Number,
      required: true,
      min: 1,
      max: 5,
      validate: {
        validator: Number.isInteger,
        message: "Rating must be a whole number between 1 and 5",
      },
    },

    title: {
      type: String,
      trim: true,
      maxlength: 150,
      default: "",
    },

    comment: {
      type: String,
      trim: true,
      maxlength: 2000,
      default: "",
    },

    isVerifiedPurchase: {
      type: Boolean,
      default: false,
    },

    status: {
      type: String,
      enum: ["pending", "approved", "rejected"],
      default: "pending",
    },

    moderatedAt: {
      type: Date,
      default: null,
    },

    moderatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "AdminUser",
      default: null,
    },

    rejectionReason: {
      type: String,
      trim: true,
      maxlength: 1000,
      default: "",
    },
  },
  {
    timestamps: true,
    versionKey: false,
  }
);

productReviewSchema.index({
  product: 1,
  status: 1,
  createdAt: -1,
});
productReviewSchema.index({
  user: 1,
  createdAt: -1,
});

productReviewSchema.index(
  { product: 1, user: 1, order: 1 },
  {
    unique: true,
    partialFilterExpression: {
      order: { $type: "objectId" },
    },
  }
);

const ProductReview = mongoose.model(
  "ProductReview",
  productReviewSchema
);

export default ProductReview;