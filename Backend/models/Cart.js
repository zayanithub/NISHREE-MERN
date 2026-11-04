import mongoose from "mongoose";

const cartItemSchema = new mongoose.Schema(
  {
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
      min: 1,
      max: 20,
      default: 1,
    },
  },
  {
    _id: true,
  }
);

const cartSchema = new mongoose.Schema(
  {
    user: {
  type: mongoose.Schema.Types.ObjectId,
  ref: "User",
  default: null,
},

    sessionIdHash: {
  type: String,
  default: undefined,
  select: false,
},

    items: {
      type: [cartItemSchema],
      default: [],
    },

    currency: {
      type: String,
      default: "INR",
      enum: ["INR"],
    },

    lastActivityAt: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: true,
    versionKey: false,
  }
);

cartSchema.index({ lastActivityAt: 1 });

// One cart per logged-in customer
cartSchema.index(
  { user: 1 },
  {
    unique: true,
    partialFilterExpression: {
      user: { $type: "objectId" },
    },
  }
);

// One cart per anonymous session
cartSchema.index(
  { sessionIdHash: 1 },
  {
    unique: true,
    partialFilterExpression: {
      sessionIdHash: { $type: "string" },
    },
  }
);

const Cart = mongoose.model("Cart", cartSchema);

export default Cart;