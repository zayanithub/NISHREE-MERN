import mongoose from "mongoose";

const auditLogSchema = new mongoose.Schema(
  {
    actorType: {
      type: String,
      enum: ["admin", "customer", "system"],
      required: true,
    },

    adminUser: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "AdminUser",
      default: null,
    },

    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },

    action: {
      type: String,
      required: true,
      trim: true,
      maxlength: 100,
    },

    resource: {
      type: String,
      required: true,
      trim: true,
      maxlength: 100,
    },

    resourceId: {
      type: String,
      default: null,
      maxlength: 100,
    },

    description: {
      type: String,
      trim: true,
      maxlength: 1000,
      default: "",
    },

    ipAddress: {
      type: String,
      default: null,
      maxlength: 100,
    },

    requestId: {
      type: String,
      default: null,
      maxlength: 100,
    },

    changes: {
      type: mongoose.Schema.Types.Mixed,
      default: null,
    },

    status: {
      type: String,
      enum: ["success", "failure"],
      default: "success",
    },
  },
  {
    timestamps: true,
    versionKey: false,
  }
);

auditLogSchema.index({ createdAt: -1 });
auditLogSchema.index({ actorType: 1, createdAt: -1 });
auditLogSchema.index({ resource: 1, resourceId: 1 });
auditLogSchema.index({ action: 1, createdAt: -1 });
auditLogSchema.index({ status: 1, createdAt: -1 });
auditLogSchema.index({ adminUser: 1, createdAt: -1 });

const AuditLog = mongoose.model("AuditLog", auditLogSchema);

export default AuditLog;