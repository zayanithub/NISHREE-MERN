import mongoose from "mongoose";

const productImageSchema = new mongoose.Schema(
  {
    product: {
  type: mongoose.Schema.Types.ObjectId,
  ref: "Product",
  required: true,
  index: true,
},
    url: {
      type: String,
      required: true,
      trim: true,
    },

    publicId: {
      type: String,
      required: true,
      trim: true,
    },

    contentHash: {
      type: String,
      trim: true,
      default: "",
      maxlength: 64,
    },

    altText: {
      type: String,
      trim: true,
      maxlength: 200,
      default: "",
    },

    sortOrder: {
      type: Number,
      default: 0,
      min: 0,
    },

    isPrimary: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true,
    versionKey: false,
  }
);

productImageSchema.index({ product: 1, sortOrder: 1 });

const ProductImage = mongoose.model(
  "ProductImage",
  productImageSchema
);

export default ProductImage;