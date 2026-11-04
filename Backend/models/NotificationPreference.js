import mongoose from "mongoose";

const notificationPreferenceSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      unique: true,
    },
    orderUpdates: {
      type: Boolean,
      default: true,
    },
    paymentUpdates: {
      type: Boolean,
      default: true,
    },
    shippingUpdates: {
      type: Boolean,
      default: true,
    },
    returnUpdates: {
      type: Boolean,
      default: true,
    },
    exchangeUpdates: {
      type: Boolean,
      default: true,
    },
    refundUpdates: {
      type: Boolean,
      default: true,
    },
    systemUpdates: {
      type: Boolean,
      default: true,
    },
    promotionalInApp: {
      type: Boolean,
      default: false,
    },
    promotionalEmail: {
      type: Boolean,
      default: false,
    },
    promotionalSms: {
      type: Boolean,
      default: false,
    },
    promotionalWhatsapp: {
      type: Boolean,
      default: false,
    },
    emailNotifications: {
      type: Boolean,
      default: true,
    },
    smsNotifications: {
      type: Boolean,
      default: false,
    },
    whatsappNotifications: {
      type: Boolean,
      default: false,
    },
    inAppNotifications: {
      type: Boolean,
      default: true,
    },
  },
  { timestamps: true, versionKey: false }
);

const NotificationPreference = mongoose.model(
  "NotificationPreference",
  notificationPreferenceSchema
);

export default NotificationPreference;