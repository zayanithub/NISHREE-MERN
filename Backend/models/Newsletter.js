import mongoose from "mongoose";

const newsletterSchema = new mongoose.Schema(
  {
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      maxlength: 254,
    },

    status: {
      type: String,
      enum: ["pending", "subscribed", "unsubscribed"],
      default: "pending",
    },

    consentAt: {
      type: Date,
      default: null,
    },

    unsubscribedAt: {
      type: Date,
      default: null,
    },

    verificationTokenHash: {
      type: String,
      default: null,
      select: false,
    },

    source: {
      type: String,
      enum: ["website", "checkout", "admin", "other"],
      default: "website",
    },
  },
  {
    timestamps: true,
    versionKey: false,
  }
);

const Newsletter = mongoose.model("Newsletter", newsletterSchema);

export default Newsletter;