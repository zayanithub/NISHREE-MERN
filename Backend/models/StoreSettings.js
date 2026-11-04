import mongoose from "mongoose";

const policySectionSchema = new mongoose.Schema(
  {
    content: {
      type: String,
      trim: true,
      maxlength: 12000,
      default: "",
    },
    isPublished: {
      type: Boolean,
      default: false,
    },
  },
  { _id: false }
);

const policySchema = new mongoose.Schema(
  {
    cod: { type: policySectionSchema, default: () => ({}) },
    returns: { type: policySectionSchema, default: () => ({}) },
    refunds: { type: policySectionSchema, default: () => ({}) },
    damaged: { type: policySectionSchema, default: () => ({}) },
    shipping: { type: policySectionSchema, default: () => ({}) },
    privacy: { type: policySectionSchema, default: () => ({}) },
    terms: { type: policySectionSchema, default: () => ({}) },
  },
  { _id: false }
);

const storeSettingsSchema = new mongoose.Schema(
  {
    key: {
      type: String,
      default: "main",
      unique: true,
      immutable: true,
    },
    storeName: {
      type: String,
      default: "Nishree Attire",
      trim: true,
    },
    supportEmail: {
      type: String,
      trim: true,
      lowercase: true,
      default: "",
    },
    supportPhone: {
      type: String,
      trim: true,
      default: "9344901028",
    },
    businessAddress: {
      type: String,
      trim: true,
      default: "44/41, Pillaiyar Kovil 1st Street, Mambakkam, Chennai, Tamil Nadu 600127, India.",
      maxlength: 500,
    },
    whatsappNumber: {
      type: String,
      trim: true,
      default: "919344901028",
    },
    whatsappUrl: {
      type: String,
      trim: true,
      default: "https://wa.me/919344901028/?text=Hi,%20Can%20you%20send%20details%20about%20your%20products",
      maxlength: 500,
    },
    instagramUrl: {
      type: String,
      trim: true,
      default: "https://www.instagram.com/nishree_fashions/",
      maxlength: 300,
    },
    facebookUrl: {
      type: String,
      trim: true,
      default: "https://www.facebook.com/share/19KgfTEgdN/",
      maxlength: 300,
    },
    policies: {
      type: policySchema,
      default: () => ({}),
    },
    currency: {
      type: String,
      enum: ["INR"],
      default: "INR",
    },
    defaultShippingCharge: {
      type: Number,
      default: 0,
      min: 0,
    },
    freeShippingThreshold: {
      type: Number,
      default: null,
      min: 0,
    },
        // Return policy
    returnsEnabled: {
      type: Boolean,
      default: true,
    },

    returnWindowDays: {
      type: Number,
      default: 5,
      min: 1,
      max: 60,
      validate: {
        validator: Number.isInteger,
        message: "Return window must be a whole number of days.",
      },
    },

    // Exchange policy
    exchangesEnabled: {
      type: Boolean,
      default: true,
    },

    exchangeWindowDays: {
      type: Number,
      default: 5,
      min: 1,
      max: 60,
      validate: {
        validator: Number.isInteger,
        message: "Exchange window must be a whole number of days.",
      },
    },
    taxRate: {
      type: Number,
      default: 0,
      min: 0,
      max: 100,
    },
    codEnabled: {
      type: Boolean,
      default: true,
    },
    razorpayEnabled: {
      type: Boolean,
      default: false,
    },
    maintenanceMode: {
      type: Boolean,
      default: false,
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

const StoreSettings = mongoose.model(
  "StoreSettings",
  storeSettingsSchema
);

export default StoreSettings;
