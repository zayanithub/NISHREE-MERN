import { createHmac, timingSafeEqual } from "node:crypto";
import NotificationLog from "../models/NotificationLog.js";
import NotificationPreference from "../models/NotificationPreference.js";
import User from "../models/User.js";

const createError = (message, statusCode = 400) => {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
};

const safeCompare = (expected, supplied) => {
  const expectedBuffer = Buffer.from(expected);
  const suppliedBuffer = Buffer.from(supplied || "");
  return (
    expectedBuffer.length === suppliedBuffer.length &&
    timingSafeEqual(expectedBuffer, suppliedBuffer)
  );
};

const getPublicWebhookUrl = (originalUrl) => {
  const publicApiUrl = process.env.PUBLIC_API_URL;
  if (!publicApiUrl) {
    throw createError("Webhook public URL is not configured.", 503);
  }
  const base = new URL(publicApiUrl);
  if (
    base.protocol !== "https:" &&
    !(base.hostname === "localhost" || base.hostname === "127.0.0.1")
  ) {
    throw createError("Webhook public URL must use HTTPS.", 503);
  }
  return new URL(originalUrl, base).toString();
};

export const verifyTwilioSignature = ({
  signature,
  originalUrl,
  parameters,
}) => {
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  if (!authToken || !signature || !parameters || typeof parameters !== "object") {
    return false;
  }
  let signedData = getPublicWebhookUrl(originalUrl);
  for (const key of Object.keys(parameters).sort()) {
    const values = Array.isArray(parameters[key])
      ? parameters[key]
      : [parameters[key]];
    for (const value of values.sort()) {
      signedData += `${key}${value ?? ""}`;
    }
  }
  const expected = createHmac("sha1", authToken)
    .update(signedData)
    .digest("base64");
  return safeCompare(expected, signature);
};

const updateSmsOptOut = async (parameters) => {
  const optOutType = String(parameters.OptOutType || "").toUpperCase();
  if (!["STOP", "START"].includes(optOutType)) {
    return false;
  }
  const phone = parameters.From;
  if (typeof phone !== "string" || !/^\+[1-9]\d{7,14}$/.test(phone)) {
    throw createError("SMS opt-out webhook phone number is invalid.");
  }
  const user = await User.findOne({ phone }).select("_id").lean();
  if (!user) {
    return false;
  }
  await NotificationPreference.findOneAndUpdate(
    { user: user._id },
    {
      $set: {
        user: user._id,
        smsNotifications: optOutType === "START",
        promotionalSms: optOutType === "START",
      },
    },
    { upsert: true, runValidators: true }
  );
  return true;
};

export const processTwilioNotificationWebhook = async ({
  signature,
  originalUrl,
  parameters,
}) => {
  if (
    !verifyTwilioSignature({
      signature,
      originalUrl,
      parameters,
    })
  ) {
    throw createError("Twilio webhook signature is invalid.", 401);
  }

  if (parameters.OptOutType) {
    return {
      type: "sms_opt_out",
      updated: await updateSmsOptOut(parameters),
    };
  }

  const providerMessageId = parameters.MessageSid;
  const status = String(parameters.MessageStatus || "").toLowerCase();
  if (
    typeof providerMessageId !== "string" ||
    !["queued", "accepted", "sending", "sent", "delivered", "failed", "undelivered"].includes(status)
  ) {
    throw createError("Twilio delivery status payload is invalid.");
  }
  const mappedStatus =
    status === "delivered"
      ? "delivered"
      : ["failed", "undelivered"].includes(status)
        ? "failed"
        : "sent";
  const update = {
    status: mappedStatus,
  };
  if (mappedStatus === "delivered") {
    update.deliveredAt = new Date();
    update.errorMessage = null;
  }
  if (mappedStatus === "failed") {
    update.errorMessage = String(
      parameters.ErrorMessage || parameters.ErrorCode || "SMS delivery failed."
    ).slice(0, 1000);
    update.lastErrorCode = String(
      parameters.ErrorCode || "TWILIO_DELIVERY_FAILED"
    ).slice(0, 100);
  }
  const result = await NotificationLog.updateOne(
    {
      channel: "sms",
      providerMessageId,
      status: { $in: ["sending", "sent", "queued", "uncertain"] },
    },
    { $set: update }
  );
  return { type: "sms_delivery", updated: result.modifiedCount === 1 };
};

const extractMetaStatuses = (payload) =>
  (payload.entry || []).flatMap((entry) =>
    (entry.changes || []).flatMap((change) =>
      change.value?.statuses || []
    )
  );

export const verifyMetaWebhookSignature = (rawBody, signature) => {
  const appSecret = process.env.META_APP_SECRET;
  if (!appSecret || !Buffer.isBuffer(rawBody) || !signature) {
    return false;
  }
  const expected = `sha256=${createHmac("sha256", appSecret)
    .update(rawBody)
    .digest("hex")}`;
  return safeCompare(expected, signature);
};

export const verifyMetaWebhookToken = (token) =>
  Boolean(
    process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN &&
      typeof token === "string" &&
      safeCompare(process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN, token)
  );

const updateWhatsAppOptOuts = async (payload) => {
  const messages = (payload.entry || []).flatMap((entry) =>
    (entry.changes || []).flatMap((change) =>
      change.value?.messages || []
    )
  );
  let updated = 0;
  for (const message of messages) {
    const action = String(message.text?.body || "").trim().toUpperCase();
    if (!["STOP", "START"].includes(action)) {
      continue;
    }
    const rawPhone = String(message.from || "");
    const phone = rawPhone.startsWith("+") ? rawPhone : `+${rawPhone}`;
    if (!/^\+[1-9]\d{7,14}$/.test(phone)) {
      console.error(
        "WhatsApp opt-out webhook contained an invalid sender number."
      );
      continue;
    }
    const user = await User.findOne({ phone }).select("_id").lean();
    if (!user) {
      continue;
    }
    await NotificationPreference.findOneAndUpdate(
      { user: user._id },
      {
        $set: {
          user: user._id,
          whatsappNotifications: action === "START",
          promotionalWhatsapp: action === "START",
        },
      },
      { upsert: true, runValidators: true }
    );
    updated += 1;
  }
  return updated;
};

export const processMetaNotificationWebhook = async ({
  rawBody,
  signature,
}) => {
  if (!verifyMetaWebhookSignature(rawBody, signature)) {
    throw createError("Meta webhook signature is invalid.", 401);
  }
  let payload;
  try {
    payload = JSON.parse(rawBody.toString("utf8"));
  } catch {
    throw createError("Meta webhook payload is invalid JSON.");
  }

  const messages = (payload.entry || []).flatMap((entry) =>
    (entry.changes || []).flatMap((change) =>
      change.value?.messages || []
    )
  );
  const optOutsUpdated = await updateWhatsAppOptOuts(payload);
  let statusUpdates = 0;
  for (const item of extractMetaStatuses(payload)) {
    if (typeof item.id !== "string") {
      continue;
    }
    const status = String(item.status || "").toLowerCase();
    const mappedStatus =
      ["delivered", "read"].includes(status)
        ? "delivered"
        : status === "failed"
          ? "failed"
          : status === "sent"
            ? "sent"
            : null;
    if (!mappedStatus) {
      continue;
    }
    const update = { status: mappedStatus };
    if (mappedStatus === "delivered") {
      update.deliveredAt = new Date();
      update.errorMessage = null;
    }
    if (mappedStatus === "failed") {
      update.errorMessage = JSON.stringify(item.errors || []).slice(0, 1000);
      update.lastErrorCode = "META_WHATSAPP_DELIVERY_FAILED";
    }
    const result = await NotificationLog.updateOne(
      {
        channel: "whatsapp",
        providerMessageId: item.id,
        status: { $in: ["sending", "sent", "queued", "uncertain"] },
      },
      { $set: update }
    );
    statusUpdates += result.modifiedCount;
  }
  return { optOutsUpdated, statusUpdates, messagesReceived: messages.length };
};
