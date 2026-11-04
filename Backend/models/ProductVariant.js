
import mongoose from "mongoose";

const productVariantSchema = new mongoose.Schema(
  {
    product: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Product",
      required: true,
      index: true,
    },

    sku: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      uppercase: true,
      maxlength: 100,
    },

    name: {
      type: String,
      required: true,
      trim: true,
      maxlength: 100,
    },

    color: {
      type: String,
      trim: true,
      maxlength: 50,
      default: "",
    },

    colorCode: {
      type: String,
      trim: true,
      match: [
        /^#([0-9A-Fa-f]{3}|[0-9A-Fa-f]{6})$/,
        "Color code must be a valid hex color",
      ],
      default: null,
    },

    blouseOption: {
      type: String,
      enum: ["with_blouse", "without_blouse", "stitched_blouse"],
      default: "with_blouse",
    },

    priceAdjustment: {
      type: Number,
      default: 0,
      validate: {
        validator(value) {
          return Number.isFinite(value);
        },
        message: "Price adjustment must be a valid number",
      },
    },

    image: {
      url: {
        type: String,
        default: "",
      },
      publicId: {
        type: String,
        default: "",
      },
    },

    isActive: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
    versionKey: false,
  }
);

productVariantSchema.index({ product: 1, isActive: 1 });

const ProductVariant = mongoose.model(
  "ProductVariant",
  productVariantSchema
);

export default ProductVariant;
