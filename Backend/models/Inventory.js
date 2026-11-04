import mongoose from "mongoose";

const inventorySchema = new mongoose.Schema(
  {
    inventoryType: {
      type: String,
      enum: ["product", "variant"],
      required: true,
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

    quantity: {
      type: Number,
      required: true,
      default: 0,
      min: 0,
      validate: {
        validator: Number.isInteger,
        message: "Quantity must be a whole number",
      },
    },

    reservedQuantity: {
      type: Number,
      required: true,
      default: 0,
      min: 0,
      validate: {
        validator: Number.isInteger,
        message: "Reserved quantity must be a whole number",
      },
    },

    lowStockThreshold: {
      type: Number,
      default: 5,
      min: 0,
      validate: {
        validator: Number.isInteger,
        message: "Low stock threshold must be a whole number",
      },
    },

    lastRestockedAt: {
      type: Date,
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

// Validate the relationship between inventory type and variant.
inventorySchema.pre("validate", function () {
  if (this.inventoryType === "product" && this.variant != null) {
    this.invalidate(
      "variant",
      "Product inventory must not reference a variant"
    );
  }

  if (this.inventoryType === "variant" && this.variant == null) {
    this.invalidate(
      "variant",
      "Variant inventory requires a variant reference"
    );
  }

  if (this.reservedQuantity > this.quantity) {
    this.invalidate(
      "reservedQuantity",
      "Reserved quantity cannot exceed total quantity"
    );
  }
});

// One inventory record per product-level stock pool.
inventorySchema.index(
  { product: 1 },
  {
    unique: true,
    partialFilterExpression: {
      inventoryType: "product",
    },
  }
);

// One inventory record per variant stock pool.
inventorySchema.index(
  { variant: 1 },
  {
    unique: true,
    partialFilterExpression: {
      inventoryType: "variant",
    },
  }
);

inventorySchema.index({ quantity: 1, reservedQuantity: 1 });

inventorySchema.virtual("availableQuantity").get(function () {
  return this.quantity - this.reservedQuantity;
});

const Inventory = mongoose.model("Inventory", inventorySchema);

export default Inventory;