import mongoose from "mongoose";

const productSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      trim: true,
      default: "Untitled product",
      maxlength: 200,
    },

    slug: {
      type: String,
      unique: true,
      lowercase: true,
      trim: true,
      maxlength: 220,
    },

    sku: {
      type: String,
      unique: true,
      uppercase: true,
      trim: true,
      maxlength: 100,
    },

    description: {
      type: String,
      trim: true,
      default: "",
      maxlength: 10000,
    },

    shortDescription: {
      type: String,
      trim: true,
      maxlength: 500,
      default: "",
    },

    category: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Category",
      default: null,
      index: true,
    },

    brand: {
      type: String,
      trim: true,
      default: "Nishree Attire",
      maxlength: 100,
    },

    material: {
      type: String,
      trim: true,
      default: "",
      maxlength: 100,
    },

    color: {
      type: String,
      trim: true,
      default: "",
      maxlength: 50,
    },

    sareeLength: {
      type: String,
      trim: true,
      default: "",
      maxlength: 50,
    },

    blouseIncluded: {
      type: Boolean,
      default: false,
    },

    blouseType: {
      type: String,
      enum: ["unstitched", "stitched", "none"],
      default: "none",
    },

    basePrice: {
      type: Number,
      default: 0,
      min: 0,
    },

    salePrice: {
      type: Number,
      default: null,
      min: 0,
      validate: {
        validator(value) {
          return value == null || value <= this.basePrice;
        },
        message: "Sale price cannot exceed base price",
      },
    },

    currency: {
      type: String,
      default: "INR",
      enum: ["INR"],
    },

    primaryImage: {
      url: {
        type: String,
        default: "",
      },
      publicId: {
        type: String,
        default: "",
      },
    },

    imageAltText: {
      type: String,
      trim: true,
      maxlength: 200,
      default: "",
    },

    imageCredit: {
      type: String,
      trim: true,
      maxlength: 300,
      default: "",
    },

    imageLicense: {
      type: String,
      trim: true,
      maxlength: 100,
      default: "",
    },

    imageSourceUrl: {
      type: String,
      trim: true,
      maxlength: 500,
      default: "",
    },

    variants: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "ProductVariant",
      },
    ],

    tags: [
      {
        type: String,
        trim: true,
        lowercase: true,
        maxlength: 50,
      },
    ],

    fabricCare: {
      type: String,
      trim: true,
      maxlength: 1000,
      default: "",
    },

    occasion: [
      {
        type: String,
        trim: true,
        maxlength: 50,
      },
    ],

    isFeatured: {
      type: Boolean,
      default: false,
    },

    status: {
      type: String,
      enum: ["draft", "active", "archived"],
      default: "draft",
      index: true,
    },

    seoTitle: {
      type: String,
      trim: true,
      maxlength: 70,
      default: "",
    },

    seoDescription: {
      type: String,
      trim: true,
      maxlength: 200,
      default: "",
    },

    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "AdminUser",
      default: null,
    },

    updatedBy: {
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

productSchema.index({ category: 1, status: 1 });
productSchema.index({ status: 1, createdAt: -1 });
productSchema.index({ isFeatured: 1, status: 1 });
productSchema.index({
  name: "text",
  description: "text",
  tags: "text",
});

const Product = mongoose.model("Product", productSchema);

export default Product;
