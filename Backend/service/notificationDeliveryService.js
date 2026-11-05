import { Buffer } from "node:buffer";
import NotificationLog from "../models/NotificationLog.js";
import NotificationPreference from "../models/NotificationPreference.js";
import NotificationTemplate from "../models/NotificationTemplate.js";
import User from "../models/User.js";
import { renderBrandedEmail, sendTransactionalEmail } from "./emailService.js";
import { createPollingBackoff, isMongoConnectivityError } from "./pollingBackoff.js";

const MAX_ATTEMPTS = 5;
const BATCH_SIZE = 10;
const POLL_INTERVAL_MS = 2000;
const STALE_SENDING_MS = 10 * 60 * 1000;
const MAX_RETRY_DELAY_MS = 60 * 60 * 1000;
const channels = ["email", "sms", "whatsapp"];

const builtInTemplate = ({ channel, title, message, actionUrl }) => ({
  subject: title,
  body:
    channel === "email"
      ? `${message}${actionUrl ? `\n\nView details: ${actionUrl}` : ""}`
      : `${title}: ${message}`,
});

const validateInternalActionPath = (actionUrl) => {
  if (
    actionUrl == null ||
    (typeof actionUrl === "string" &&
      actionUrl.startsWith("/") &&
      !actionUrl.startsWith("//") &&
      !actionUrl.includes("\\") &&
      !/%2f/i.test(actionUrl) &&
      !/[\r\n]/.test(actionUrl))
  ) {
    return actionUrl ?? null;
  }
  const error = new Error("Notification action URL must be an internal path.");
  error.code = "UNSAFE_ACTION_URL";
  error.retryable = false;
  throw error;
};

const renderTemplateText = (template, variables) => {
  const allowed = new Set(template.variables || []);
  return String(template.body).replace(
    /\{\{\s*([a-zA-Z][a-zA-Z0-9_]*)\s*\}\}/g,
    (match, key) => {
      if (!allowed.has(key) || !Object.hasOwn(variables, key)) {
        throw new Error(`Template variable "${key}" is not available.`);
      }
      return String(variables[key] ?? "");
    }
  );
};

const requireProviderMessageId = (id, providerName) => {
  if (typeof id !== "string" || !id.trim()) {
    const error = new Error(
      `${providerName} accepted no trackable message ID.`
    );
    error.code = "PROVIDER_MESSAGE_ID_MISSING";
    error.retryable = false;
    throw error;
  }
  return id;
};

const getTemplate = async (log, variables) => {
  const stored = await NotificationTemplate.findOne({
    key: log.templateKey,
    channel: log.channel,
  }).lean();

  if (stored) {
    if (!stored.isActive) {
      const error = new Error(
        `Notification template "${log.templateKey}" is inactive for ${log.channel}.`
      );
      error.code = "NOTIFICATION_TEMPLATE_INACTIVE";
      error.retryable = false;
      throw error;
    }
    const body = renderTemplateText(stored, variables);
    const subject = stored.subject
      ? renderTemplateText(
          { ...stored, body: stored.subject },
          variables
        )
      : variables.title;
    return { subject, body };
  }

  return builtInTemplate({
    channel: log.channel,
    ...variables,
  });
};

const fetchWithTimeout = async (url, options) => {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15000);
  try {
    return await fetch(url, {
      ...options,
      signal: controller.signal,
    });
  } catch (error) {
    error.retryable = true;
    if (error.name === "AbortError") {
      error.code = "PROVIDER_TIMEOUT";
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
};

const parseProviderResponse = async (response, providerName) => {
  const rawBody = await response.text();
  let payload = {};
  if (rawBody) {
    try {
      payload = JSON.parse(rawBody);
    } catch {
      payload = {};
    }
  }
  if (!response.ok) {
    const error = new Error(
      payload.message ||
        payload.error?.message ||
        `${providerName} returned HTTP ${response.status}`
    );
    error.code =
      payload.code || payload.error?.code || `${providerName.toUpperCase()}_HTTP_${response.status}`;
    error.retryable = response.status === 429 || response.status >= 500;
    throw error;
  }
  return payload;
};

const sendSms = async (log, body) => {
  const { TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_FROM_NUMBER } =
    process.env;
  if (!TWILIO_ACCOUNT_SID || !TWILIO_AUTH_TOKEN || !TWILIO_FROM_NUMBER) {
    const error = new Error("Twilio SMS configuration is incomplete.");
    error.code = "TWILIO_CONFIG_MISSING";
    error.retryable = false;
    throw error;
  }

  const form = new URLSearchParams({
    To: log.recipient,
    From: TWILIO_FROM_NUMBER,
    Body: body,
  });
  if (process.env.PUBLIC_API_URL) {
    let callbackUrl;
    try {
      callbackUrl = new URL(
        "/api/v1/notification-delivery-webhooks/twilio",
        process.env.PUBLIC_API_URL
      );
    } catch {
      const error = new Error("PUBLIC_API_URL is invalid.");
      error.code = "PUBLIC_API_URL_INVALID";
      error.retryable = false;
      throw error;
    }
    if (
      callbackUrl.protocol !== "https:" &&
      !(callbackUrl.hostname === "localhost" || callbackUrl.hostname === "127.0.0.1")
    ) {
      const error = new Error("PUBLIC_API_URL must use HTTPS.");
      error.code = "PUBLIC_API_URL_INVALID";
      error.retryable = false;
      throw error;
    }
    form.set("StatusCallback", callbackUrl.toString());
  }
  const auth = Buffer.from(
    `${TWILIO_ACCOUNT_SID}:${TWILIO_AUTH_TOKEN}`
  ).toString("base64");
  const response = await fetchWithTimeout(
    `https://api.twilio.com/2010-04-01/Accounts/${encodeURIComponent(
      TWILIO_ACCOUNT_SID
    )}/Messages.json`,
    {
      method: "POST",
      headers: {
        Authorization: `Basic ${auth}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: form,
    }
  );
  const payload = await parseProviderResponse(response, "Twilio");
  return {
    provider: "twilio",
    providerMessageId: requireProviderMessageId(payload.sid, "Twilio"),
  };
};

const sendWhatsApp = async (log, bodyText) => {
  const { WHATSAPP_ACCESS_TOKEN, WHATSAPP_PHONE_NUMBER_ID } = process.env;
  const templateName = process.env[
    `WHATSAPP_TEMPLATE_${String(log.templateKey).toUpperCase()}`
  ];
  if (
    !WHATSAPP_ACCESS_TOKEN ||
    !WHATSAPP_PHONE_NUMBER_ID ||
    !templateName ||
    !/^v\d+\.\d+$/.test(process.env.WHATSAPP_GRAPH_VERSION || "")
  ) {
    const error = new Error(
      `Meta WhatsApp configuration or approved template is missing for ${log.templateKey}.`
    );
    error.code = "WHATSAPP_CONFIG_MISSING";
    error.retryable = false;
    throw error;
  }

  const response = await fetchWithTimeout(
    `https://graph.facebook.com/${encodeURIComponent(
      process.env.WHATSAPP_GRAPH_VERSION
    )}/${encodeURIComponent(WHATSAPP_PHONE_NUMBER_ID)}/messages`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${WHATSAPP_ACCESS_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        recipient_type: "individual",
        to: log.recipient,
        type: "template",
        template: {
          name: templateName,
          language: {
            code: process.env.WHATSAPP_TEMPLATE_LANGUAGE || "en",
          },
          components: [
            {
              type: "body",
              parameters: [
                {
                  type: "text",
                  text: String(bodyText),
                },
              ],
            },
          ],
        },
        biz_opaque_callback_data: String(log._id),
      }),
    }
  );
  const payload = await parseProviderResponse(response, "Meta WhatsApp");
  return {
    provider: "meta_whatsapp",
    providerMessageId: requireProviderMessageId(
      payload.messages?.[0]?.id,
      "Meta WhatsApp"
    ),
  };
};

const sendDelivery = async (log) => {
  const variables = log.metadata?.templateVariables;
  if (!variables || typeof variables !== "object") {
    const error = new Error("Delivery template variables are missing.");
    error.code = "DELIVERY_PAYLOAD_MISSING";
    error.retryable = false;
    throw error;
  }
  const template = await getTemplate(log, variables);

  if (log.channel === "email") {
    const frontendUrl = process.env.FRONTEND_URL || "http://localhost:5173";
    let actionUrl = null;
    if (variables.actionUrl) {
      if (
        typeof variables.actionUrl !== "string" ||
        !variables.actionUrl.startsWith("/") ||
        variables.actionUrl.startsWith("//") ||
        variables.actionUrl.includes("\\") ||
        /%2f/i.test(variables.actionUrl)
      ) {
        const error = new Error(
          "Email action link must be a safe internal path."
        );
        error.code = "UNSAFE_ACTION_URL";
        error.retryable = false;
        throw error;
      }
      const parsedUrl = new URL(variables.actionUrl, frontendUrl);
      if (parsedUrl.origin !== new URL(frontendUrl).origin) {
        const error = new Error(
          "Email action link must remain on the configured storefront."
        );
        error.code = "UNSAFE_ACTION_URL";
        error.retryable = false;
        throw error;
      }
      actionUrl = parsedUrl.toString();
    }
    const result = await sendTransactionalEmail({
      to: log.recipient,
      subject: template.subject,
      text: template.body,
      html: renderBrandedEmail({
        title: template.subject,
        preheader: template.body.slice(0, 150),
        body: template.body,
        actionUrl,
        actionLabel: "View details",
      }),
    });
    return {
      provider: "smtp",
      providerMessageId: requireProviderMessageId(
        result.messageId,
        "SMTP"
      ),
    };
  }

  if (log.channel === "sms") {
    return sendSms(log, template.body);
  }
  if (log.channel === "whatsapp") {
    if (template.body.length > 1024) {
      const error = new Error(
        "WhatsApp template parameter exceeds the provider's 1024-character limit."
      );
      error.code = "WHATSAPP_TEMPLATE_PARAMETER_TOO_LONG";
      error.retryable = false;
      throw error;
    }
    return sendWhatsApp(log, template.body);
  }
  throw new Error(`Unsupported delivery channel: ${log.channel}`);
};

const nextAttemptAt = (attempts, now = Date.now()) => {
  const delay = Math.min(
    60_000 * 2 ** Math.max(0, attempts - 1),
    MAX_RETRY_DELAY_MS
  );
  return new Date(now + delay);
};

const getDeliveryFailureState = (error, attempts) => {
  const outcomeUnknown = error?.outcomeUnknown === true;
  const retryable = !outcomeUnknown && error?.retryable !== false;
  const terminal = !retryable || attempts >= MAX_ATTEMPTS;
  return {
    outcomeUnknown,
    status: outcomeUnknown ? "uncertain" : terminal ? "failed" : "queued",
    lastErrorCode: outcomeUnknown
      ? "SMTP_OUTCOME_UNKNOWN"
      : String(error?.code || "DELIVERY_FAILED").slice(0, 100),
    nextAttemptAt:
      outcomeUnknown || terminal ? null : nextAttemptAt(attempts),
  };
};

export const enqueueCustomerDeliveries = async ({
  userId,
  eventType,
  deliveryKey,
  title,
  message,
  actionUrl = null,
  orderId = null,
  promotional = false,
}) => {
  const safeActionUrl = validateInternalActionPath(actionUrl);
  if (
    User.db.readyState !== 1 ||
    NotificationPreference.db.readyState !== 1 ||
    NotificationLog.db.readyState !== 1
  ) {
    throw new Error("Notification delivery database is not connected.");
  }
  const [user, preferences] = await Promise.all([
    User.findById(userId).select("email phone").lean(),
    NotificationPreference.findOne({ user: userId }).lean(),
  ]);
  if (!user) {
    throw new Error("Notification delivery customer was not found.");
  }

  const preference = preferences || {};
  const preferenceFor = {
    email: promotional
      ? preference.promotionalEmail === true
      : preference.emailNotifications !== false,
    sms: promotional
      ? preference.promotionalSms === true
      : preference.smsNotifications === true,
    whatsapp: promotional
      ? preference.promotionalWhatsapp === true
      : preference.whatsappNotifications === true,
  };
  const recipientFor = {
    email: user.email,
    sms: user.phone,
    whatsapp: user.phone,
  };
  const templateKey = `${eventType}_update`;
  const variables = { title, message, actionUrl };
  const queued = [];

  for (const channel of channels) {
    if (!preferenceFor[channel] || !recipientFor[channel]) {
      continue;
    }
    if (
      ["sms", "whatsapp"].includes(channel) &&
      !/^\+[1-9]\d{7,14}$/.test(recipientFor[channel])
    ) {
      console.error(
        "Notification delivery skipped: customer phone is not in E.164 format.",
        channel
      );
      continue;
    }
    const key = `${deliveryKey}:${channel}`;
    const log = await NotificationLog.findOneAndUpdate(
      { deliveryKey: key },
      {
        $setOnInsert: {
          user: userId,
          order: orderId,
          templateKey,
          deliveryKey: key,
          eventType,
          channel,
          recipient: recipientFor[channel],
          provider: {
            email: "smtp",
            sms: "twilio",
            whatsapp: "meta_whatsapp",
          }[channel],
          status: "queued",
          nextAttemptAt: new Date(),
          attempts: 0,
          metadata: {
            templateVariables: variables,
            promotional,
          },
        },
      },
      { upsert: true, returnDocument: "after", runValidators: true }
    );
    queued.push(log);
  }
  return queued;
};

export const processNotificationDelivery = async (deliveryId) => {
  const log = await NotificationLog.findOneAndUpdate(
    {
      _id: deliveryId,
      status: { $in: ["queued", "failed"] },
      nextAttemptAt: { $lte: new Date() },
      attempts: { $lt: MAX_ATTEMPTS },
    },
    {
      $set: {
        status: "sending",
        lastAttemptAt: new Date(),
      },
      $inc: { attempts: 1 },
      $unset: {
        errorMessage: 1,
        lastErrorCode: 1,
      },
    },
    { returnDocument: "after", runValidators: true }
  );
  if (!log) {
    const error = new Error("Delivery is not eligible for processing.");
    error.statusCode = 409;
    throw error;
  }

  const [user, preferences] = await Promise.all([
    User.findById(log.user).select("email phone").lean(),
    NotificationPreference.findOne({ user: log.user }).lean(),
  ]);
  const preference = preferences || {};
  const currentRecipient =
    log.channel === "email" ? user?.email : user?.phone;
  const promotional = log.metadata?.promotional === true;
  const enabled =
    log.channel === "email"
      ? (promotional
          ? preference.promotionalEmail === true
          : preference.emailNotifications !== false)
      : log.channel === "sms"
        ? (promotional
            ? preference.promotionalSms === true
            : preference.smsNotifications === true)
        : (promotional
            ? preference.promotionalWhatsapp === true
            : preference.whatsappNotifications === true);

  if (!enabled || !user || currentRecipient !== log.recipient) {
    await NotificationLog.updateOne(
      { _id: log._id, status: "sending" },
      {
        $set: {
          status: "suppressed",
          errorMessage: !user
            ? "Customer account no longer exists."
            : currentRecipient !== log.recipient
              ? "Customer contact changed after the delivery was queued."
              : "Customer preference or consent no longer allows this delivery.",
          lastErrorCode: "DELIVERY_SUPPRESSED",
          nextAttemptAt: null,
        },
      }
    );
    return { id: String(log._id), status: "suppressed" };
  }

  let result;
  try {
    result = await sendDelivery(log);
  } catch (error) {
    const failureState = getDeliveryFailureState(error, log.attempts);
    const outcomeUnknown = failureState.outcomeUnknown;
    const updates = {
      status: failureState.status,
      errorMessage: outcomeUnknown
        ? "SMTP timed out during message transmission; check the provider before retrying to avoid duplicate delivery."
        : String(error.message || "Delivery failed.").slice(0, 1000),
      lastErrorCode: failureState.lastErrorCode,
      nextAttemptAt: failureState.nextAttemptAt,
    };
    await NotificationLog.updateOne(
      { _id: log._id, status: "sending" },
      { $set: updates }
    );
    console.error(
      "Notification provider delivery failed:",
      log.channel,
      updates.lastErrorCode,
      updates.errorMessage
    );
    return { id: String(log._id), status: updates.status };
  }

  try {
    await NotificationLog.updateOne(
      { _id: log._id, status: "sending" },
      {
        $set: {
          status: "sent",
          provider: result.provider,
          providerMessageId: result.providerMessageId,
          sentAt: new Date(),
          nextAttemptAt: null,
        },
      }
    );
    return {
      id: String(log._id),
      status: "sent",
      provider: result.provider,
    };
  } catch (error) {
    console.error(
      "Provider accepted notification but delivery status could not be saved:",
      log.channel,
      String(error.message || "Unknown database error")
    );
    throw error;
  }
};

export const retryNotificationDelivery = async (
  deliveryId,
  adminId,
  confirmUnknownOutcome = false
) => {
  const existing = await NotificationLog.findById(deliveryId).lean();
  if (!existing || !["failed", "uncertain"].includes(existing.status)) {
    const error = new Error("Failed notification delivery not found.");
    error.statusCode = 404;
    throw error;
  }
  if (existing.status === "uncertain" && confirmUnknownOutcome !== true) {
    const error = new Error(
      "The provider outcome is unknown. Reconcile with the provider first, then explicitly confirm duplicate-delivery risk to retry."
    );
    error.statusCode = 409;
    throw error;
  }
  if (!/^[a-f\d]{24}$/i.test(String(adminId || ""))) {
    const error = new Error("Invalid admin ID.");
    error.statusCode = 400;
    throw error;
  }
  const log = await NotificationLog.findOneAndUpdate(
    {
      _id: existing._id,
      status: existing.status,
    },
    {
      $set: {
        status: "queued",
        attempts: 0,
        nextAttemptAt: new Date(),
        retryRequestedBy: adminId,
        ...(existing.status === "uncertain"
          ? {
              "metadata.uncertainRetryConfirmedAt": new Date(),
              "metadata.uncertainRetryConfirmedBy": adminId,
            }
          : {}),
      },
      $unset: {
        errorMessage: 1,
        lastErrorCode: 1,
      },
    },
    { returnDocument: "after", runValidators: true }
  );
  if (!log) {
    const error = new Error(
      "Delivery status changed before retry could be requested."
    );
    error.statusCode = 409;
    throw error;
  }
  return log;
};

export const listAdminNotificationDeliveries = async (options = {}) => {
  const page = Number(options.page ?? 1);
  const limit = Number(options.limit ?? 20);
  if (!Number.isInteger(page) || page < 1) {
    const error = new Error("Page must be a positive integer.");
    error.statusCode = 400;
    throw error;
  }
  if (!Number.isInteger(limit) || limit < 1 || limit > 100) {
    const error = new Error("Limit must be an integer between 1 and 100.");
    error.statusCode = 400;
    throw error;
  }

  const filter = {};
  if (options.channel) {
    if (!channels.includes(options.channel)) {
      const error = new Error("Invalid notification channel filter.");
      error.statusCode = 400;
      throw error;
    }
    filter.channel = options.channel;
  }
  if (options.status) {
    if (
      ![
        "queued",
        "sending",
        "sent",
        "delivered",
        "failed",
        "suppressed",
        "uncertain",
      ].includes(options.status)
    ) {
      const error = new Error("Invalid notification delivery status filter.");
      error.statusCode = 400;
      throw error;
    }
    filter.status = options.status;
  }
  if (options.orderId) {
    if (!/^[a-f\d]{24}$/i.test(String(options.orderId))) {
      const error = new Error("Invalid order ID.");
      error.statusCode = 400;
      throw error;
    }
    filter.order = options.orderId;
  }

  const skip = (page - 1) * limit;
  const [deliveries, total] = await Promise.all([
    NotificationLog.find(filter)
      .select("-metadata.templateVariables")
      .sort({ createdAt: -1, _id: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),
    NotificationLog.countDocuments(filter),
  ]);
  return {
    deliveries,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  };
};

export const listAdminNotificationTemplates = async () =>
  NotificationTemplate.find({
    channel: { $in: channels },
  })
    .sort({ key: 1, channel: 1 })
    .lean();

export const upsertAdminNotificationTemplate = async (
  adminId,
  key,
  channel,
  data
) => {
  if (!/^[a-z][a-z0-9_]{1,79}$/.test(String(key || ""))) {
    const error = new Error("Invalid notification template key.");
    error.statusCode = 400;
    throw error;
  }
  if (!channels.includes(channel)) {
    const error = new Error("Invalid notification template channel.");
    error.statusCode = 400;
    throw error;
  }
  if (!/^[a-f\d]{24}$/i.test(String(adminId || ""))) {
    const error = new Error("Invalid admin ID.");
    error.statusCode = 400;
    throw error;
  }
  if (new Set(data.variables).size !== data.variables.length) {
    const error = new Error("Template variables must be unique.");
    error.statusCode = 400;
    throw error;
  }
  const availableVariables = new Set(["title", "message", "actionUrl"]);
  if (data.variables.some((variable) => !availableVariables.has(variable))) {
    const error = new Error(
      "Template variables must be provided by the notification event."
    );
    error.statusCode = 400;
    throw error;
  }
  const declaredVariables = new Set(data.variables);
  const placeholders = [
    ...String(data.body).matchAll(/\{\{\s*([a-zA-Z][a-zA-Z0-9_]*)\s*\}\}/g),
    ...String(data.subject || "").matchAll(
      /\{\{\s*([a-zA-Z][a-zA-Z0-9_]*)\s*\}\}/g
    ),
  ].map((match) => match[1]);
  if (placeholders.some((variable) => !declaredVariables.has(variable))) {
    const error = new Error(
      "Every template placeholder must be declared in the variables list."
    );
    error.statusCode = 400;
    throw error;
  }

  return NotificationTemplate.findOneAndUpdate(
    { key, channel },
    {
      $set: {
        name: data.name,
        subject: data.subject || "",
        body: data.body,
        variables: data.variables,
        isActive: data.isActive ?? true,
        updatedBy: adminId,
      },
      $setOnInsert: { key, channel },
    },
    {
      returnDocument: "after",
      upsert: true,
      runValidators: true,
      setDefaultsOnInsert: true,
    }
  );
};

let workerTimer = null;
let workerRunning = false;
const workerPollBackoff = createPollingBackoff({ baseDelayMs: POLL_INTERVAL_MS });

const logWorkerPollFailure = (error) => {
  const retry = workerPollBackoff.failed(error);
  if (retry.shouldLog) {
    console.error(
      `Notification worker polling failed (attempt ${retry.attempt}; retry in ${Math.ceil(retry.delayMs / 1000)}s):`,
      error.message,
    );
  }
};

const pollDeliveries = async () => {
  if (
    workerRunning ||
    NotificationLog.db.readyState !== 1 ||
    !workerPollBackoff.shouldPoll()
  ) {
    return;
  }
  workerRunning = true;
  try {
    const staleBefore = new Date(Date.now() - STALE_SENDING_MS);
    await NotificationLog.updateMany(
      {
        status: "sending",
        lastAttemptAt: { $lte: staleBefore },
      },
      {
        $set: {
          status: "uncertain",
          errorMessage:
            "The worker stopped after sending may have begun. Reconcile with the provider before retrying.",
          lastErrorCode: "PROVIDER_OUTCOME_UNKNOWN",
          nextAttemptAt: null,
        },
      }
    );
    const jobs = await NotificationLog.find({
      status: "queued",
      nextAttemptAt: { $lte: new Date() },
      attempts: { $lt: MAX_ATTEMPTS },
    })
      .sort({ createdAt: 1, _id: 1 })
      .limit(BATCH_SIZE)
      .select("_id")
      .lean();
    let connectivityFailed = false;
    for (const job of jobs) {
      try {
        await processNotificationDelivery(job._id);
      } catch (error) {
        if (isMongoConnectivityError(error)) {
          logWorkerPollFailure(error);
          connectivityFailed = true;
          break;
        }
        if (error.statusCode !== 409) {
          console.error(
            "Notification worker could not process delivery:",
            error.message
          );
        }
      }
    }
    if (!connectivityFailed && NotificationLog.db.readyState === 1) {
      workerPollBackoff.succeeded();
    }
  } catch (error) {
    logWorkerPollFailure(error);
  } finally {
    workerRunning = false;
  }
};

export const startNotificationDeliveryWorker = () => {
  if (workerTimer) {
    return;
  }
  workerTimer = setInterval(() => {
    void pollDeliveries();
  }, POLL_INTERVAL_MS);
  workerTimer.unref?.();
  void pollDeliveries();
};

export const stopNotificationDeliveryWorker = async () => {
  if (workerTimer) {
    clearInterval(workerTimer);
    workerTimer = null;
  }
  while (workerRunning) {
    await new Promise((resolve) => setTimeout(resolve, 25));
  }
};

export const notificationDeliveryInternals = {
  MAX_ATTEMPTS,
  nextAttemptAt,
  getFailureState: getDeliveryFailureState,
  renderTemplateText,
  sendDelivery,
};
