import mongoose from "mongoose";

const otpVerificationSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
      index: true,
    },

    adminUser: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "AdminUser",
      default: null,
      index: true,
    },

    purpose: {
      type: String,
      enum: [
        "email_verification",
        "phone_verification",
        "login",
        "admin_login",
        "password_reset",
      ],
      required: true,
    },

    channel: {
      type: String,
      enum: ["email", "sms", "whatsapp"],
      required: true,
    },

    destination: {
      type: String,
      required: true,
      trim: true,
    },

    otpHash: {
      type: String,
      required: true,
      select: false,
    },

    expiresAt: {
      type: Date,
      required: true,
      index: { expires: 0 },
    },

    attempts: {
      type: Number,
      default: 0,
      min: 0,
      max: 5,
    },

    maxAttempts: {
      type: Number,
      default: 5,
      min: 1,
      max: 5,
    },

    verifiedAt: {
      type: Date,
      default: null,
    },

    consumedAt: {
      type: Date,
      default: null,
    },

    revokedAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
    versionKey: false,
  }
);

otpVerificationSchema.pre("validate", function () {
  const hasUser = Boolean(this.user);
  const hasAdmin = Boolean(this.adminUser);

  if (hasUser && hasAdmin) {
    this.invalidate(
      "adminUser",
      "OTP cannot belong to both customer and admin"
    );
  }
});

otpVerificationSchema.index({
  destination: 1,
  purpose: 1,
  createdAt: -1,
});

const OTPVerification = mongoose.model(
  "OTPVerification",
  otpVerificationSchema
);

export default OTPVerification;