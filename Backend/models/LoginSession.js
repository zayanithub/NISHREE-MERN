import mongoose from "mongoose";

const loginSessionSchema = new mongoose.Schema(
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

    sessionIdHash: {
      type: String,
      required: true,
      unique: true,
      select: false,
    },

    ipAddress: {
      type: String,
      default: null,
      maxlength: 100,
    },

    userAgent: {
      type: String,
      default: null,
      maxlength: 500,
    },

    expiresAt: {
      type: Date,
      required: true,
      index: { expires: 0 },
    },

    revokedAt: {
      type: Date,
      default: null,
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

loginSessionSchema.pre("validate", function () {
  const hasUser = Boolean(this.user);
  const hasAdmin = Boolean(this.adminUser);

  if (hasUser === hasAdmin) {
    this.invalidate(
      "user",
      "A login session must belong to exactly one customer or admin"
    );
  }
});

const LoginSession = mongoose.model(
  "LoginSession",
  loginSessionSchema
);

export default LoginSession;