import mongoose from "mongoose";

const notificationTemplateSchema = new mongoose.Schema(
  {
    key: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
    },
    channel: {
      type: String,
      enum: ["email", "sms", "whatsapp", "in_app"],
      required: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
    },
    subject: {
      type: String,
      trim: true,
      default: "",
    },
    body: {
      type: String,
      required: true,
    },
    variables: {
      type: [String],
      default: [],
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    updatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "AdminUser",
      default: null,
    },
  },
  { timestamps: true, versionKey: false }
);

notificationTemplateSchema.index(
  { key: 1, channel: 1 },
  { unique: true }
);

const NotificationTemplate = mongoose.model(
  "NotificationTemplate",
  notificationTemplateSchema
);

export default NotificationTemplate;