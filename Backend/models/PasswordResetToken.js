import mongoose from "mongoose";

const passwordResetTokenSchema = new mongoose.Schema(
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

    tokenHash: {
      type: String,
      required: true,
      unique: true,
      select: false,
    },

    expiresAt: {
      type: Date,
      required: true,
      index: { expires: 0 },
    },

    usedAt: {
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

passwordResetTokenSchema.pre("validate", function () {
  const hasUser = Boolean(this.user);
  const hasAdmin = Boolean(this.adminUser);

  if (hasUser === hasAdmin) {
    this.invalidate(
      "user",
      "A reset token must belong to exactly one customer or admin"
    );
  }
});

passwordResetTokenSchema.index({
  user: 1,
  createdAt: -1,
});

passwordResetTokenSchema.index({
  adminUser: 1,
  createdAt: -1,
});

const PasswordResetToken = mongoose.model(
  "PasswordResetToken",
  passwordResetTokenSchema
);

export default PasswordResetToken;