import Notification from "../models/Notification.js";
import NotificationOutbox from "../models/NotificationOutbox.js";
import NotificationPreference from "../models/NotificationPreference.js";
import { enqueueCustomerDeliveries } from "./notificationDeliveryService.js";
import { createPollingBackoff } from "./pollingBackoff.js";

const OUTBOX_MAX_ATTEMPTS = 8;
const OUTBOX_BATCH_SIZE = 20;
const OUTBOX_POLL_INTERVAL_MS = 2000;
const OUTBOX_LEASE_MS = 2 * 60 * 1000;
const OUTBOX_MAX_RETRY_DELAY_MS = 60 * 60 * 1000;
let outboxTimer = null;
let outboxPollPromise = null;
const outboxPollBackoff = createPollingBackoff({ baseDelayMs: OUTBOX_POLL_INTERVAL_MS });

const createError = (message, statusCode) => {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
};

const isValidObjectId = (value) =>
  typeof value === "string" &&
  /^[a-f\d]{24}$/i.test(value);

const normalizeObjectId = (value) =>
  value && typeof value === "object" && value._id != null
    ? String(value._id)
    : value;

const validateObjectId = (value, fieldName) => {
  const id = value == null ? "" : String(value);
  if (!isValidObjectId(id)) {
    throw createError(`Invalid ${fieldName}.`, 400);
  }
  return id;
};

const validateOptionalObjectId = (value, fieldName) => {
  if (value == null || value === "") {
    return null;
  }
  return validateObjectId(value, fieldName);
};

const preferenceFieldByType = {
  order: "orderUpdates",
  payment: "paymentUpdates",
  shipping: "shippingUpdates",
  return: "returnUpdates",
  exchange: "exchangeUpdates",
  refund: "refundUpdates",
  promotion: "promotionalInApp",
  system: "systemUpdates",
};

const allowedTypes = Object.keys(preferenceFieldByType);

const parsePagination = (options = {}) => {
  const page = Number(options.page ?? 1);
  const limit = Number(options.limit ?? 20);
  if (!Number.isInteger(page) || page < 1) {
    throw createError("Page must be a positive integer.", 400);
  }
  if (!Number.isInteger(limit) || limit < 1 || limit > 100) {
    throw createError(
      "Limit must be an integer between 1 and 100.",
      400
    );
  }
  return { page, limit };
};

const getRecipient = (recipientType, recipientId) => {
  if (!["user", "adminUser"].includes(recipientType)) {
    throw createError("Invalid notification recipient type.", 400);
  }
  return {
    [recipientType]: validateObjectId(
      recipientId,
      recipientType === "user" ? "customer ID" : "admin ID"
    ),
  };
};

export const createInAppNotification = async (data) => {
  if (!data || typeof data !== "object" || Array.isArray(data)) {
    throw createError("Notification data must be an object.", 400);
  }
  if (Notification.db.readyState !== 1) {
    throw createError("Notification database is not connected.", 503);
  }

  const recipientType = data.recipientType ?? "user";
  const recipientFilter = getRecipient(
    recipientType,
    data.recipientId
  );
  if (!allowedTypes.includes(data.type)) {
    throw createError("Invalid notification type.", 400);
  }

  const title = typeof data.title === "string" ? data.title.trim() : "";
  const message =
    typeof data.message === "string" ? data.message.trim() : "";
  const idempotencyKey =
    typeof data.idempotencyKey === "string"
      ? data.idempotencyKey.trim()
      : "";

  if (!title || title.length > 150) {
    throw createError("Notification title must contain 1-150 characters.", 400);
  }
  if (!message || message.length > 2000) {
    throw createError("Notification message must contain 1-2000 characters.", 400);
  }
  if (!idempotencyKey || idempotencyKey.length > 200) {
    throw createError("A notification idempotency key is required.", 400);
  }
  if (
    data.metadata !== undefined &&
    (!data.metadata ||
      typeof data.metadata !== "object" ||
      Array.isArray(data.metadata))
  ) {
    throw createError("Notification metadata must be an object.", 400);
  }

  if (recipientType === "user") {
    if (NotificationPreference.db.readyState !== 1) {
      throw createError(
        "Notification preferences database is not connected.",
        503
      );
    }
    const preference = await NotificationPreference.findOne({
      user: recipientFilter.user,
    }).lean();
    const preferenceField = preferenceFieldByType[data.type];
    if (
      preference?.inAppNotifications === false ||
      preference?.[preferenceField] === false
    ) {
      return null;
    }
  }

  const notificationData = {
    ...recipientFilter,
    type: data.type,
    title,
    message,
    relatedOrder: validateOptionalObjectId(
      data.relatedOrder,
      "related order ID"
    ),
    relatedProduct: validateOptionalObjectId(
      data.relatedProduct,
      "related product ID"
    ),
    actionUrl: data.actionUrl ?? null,
    idempotencyKey,
    ...(data.metadata ? { metadata: data.metadata } : {}),
  };

  try {
    return await Notification.findOneAndUpdate(
      { idempotencyKey, ...recipientFilter },
      { $setOnInsert: notificationData },
      { upsert: true, returnDocument: "after", runValidators: true }
    );
  } catch (error) {
    if (error.code !== 11000) {
      throw error;
    }
    const existing = await Notification.findOne({
      idempotencyKey,
      ...recipientFilter,
    }).lean();
    if (existing) {
      return existing;
    }
    throw createError(
      "Notification idempotency key conflicts with another recipient.",
      409
    );
  }
};

export const emitCustomerNotification = async (data) => {
  try {
    const recipientId = normalizeObjectId(data?.recipientId);
    if (
      !data ||
      typeof data !== "object" ||
      !isValidObjectId(String(recipientId || "")) ||
      !allowedTypes.includes(data.type) ||
      typeof data.idempotencyKey !== "string" ||
      !data.idempotencyKey.trim() ||
      data.idempotencyKey.length > 200
    ) {
      throw createError("Notification outbox event is invalid.", 400);
    }
    const title = typeof data.title === "string" ? data.title.trim() : "";
    const message = typeof data.message === "string" ? data.message.trim() : "";
    if (!title || title.length > 150 || !message || message.length > 2000) {
      throw createError("Notification outbox content is invalid.", 400);
    }
    if (
      data.metadata !== undefined &&
      (!data.metadata ||
        typeof data.metadata !== "object" ||
        Array.isArray(data.metadata))
    ) {
      throw createError("Notification metadata must be an object.", 400);
    }
    if (NotificationOutbox.db.readyState !== 1) {
      throw createError(
        "Notification outbox database is not connected.",
        503
      );
    }

    const payload = {
      recipientType: "user",
      recipientId: String(recipientId),
      type: data.type,
      title,
      message,
      relatedOrder: validateOptionalObjectId(
        normalizeObjectId(data.relatedOrder),
        "related order ID"
      ),
      relatedProduct: validateOptionalObjectId(
        normalizeObjectId(data.relatedProduct),
        "related product ID"
      ),
      actionUrl: data.actionUrl ?? null,
      idempotencyKey: data.idempotencyKey.trim(),
      ...(data.metadata ? { metadata: data.metadata } : {}),
    };
    if (
      payload.actionUrl != null &&
      (typeof payload.actionUrl !== "string" ||
        !payload.actionUrl.startsWith("/") ||
        payload.actionUrl.startsWith("//") ||
        payload.actionUrl.includes("\\") ||
        /%2f/i.test(payload.actionUrl) ||
        /[\r\n]/.test(payload.actionUrl))
    ) {
      throw createError(
        "Notification action URL must be an internal path.",
        400
      );
    }

    try {
      const outboxEvent = await NotificationOutbox.findOneAndUpdate(
        {
          user: payload.recipientId,
          eventKey: payload.idempotencyKey,
        },
        {
          $setOnInsert: {
            user: payload.recipientId,
            eventKey: payload.idempotencyKey,
            payload,
            status: "pending",
            nextAttemptAt: new Date(),
          },
        },
        { upsert: true, returnDocument: "after", runValidators: true }
      );
      return await processNotificationOutboxEvent(outboxEvent._id);
    } catch (error) {
      if (error.code !== 11000) {
        throw error;
      }
      const existing = await NotificationOutbox.findOne({
        user: payload.recipientId,
        eventKey: payload.idempotencyKey,
      }).lean();
      if (!existing) {
        throw error;
      }
      return processNotificationOutboxEvent(existing._id);
    }
  } catch (error) {
    console.error("Notification outbox event failed:", error.message);
    return null;
  }
};

export const processNotificationOutboxEvent = async (outboxId) => {
  const now = new Date();
  const claimed = await NotificationOutbox.findOneAndUpdate(
    {
      _id: outboxId,
      $or: [
        {
          status: "pending",
          nextAttemptAt: { $lte: now },
          attempts: { $lt: OUTBOX_MAX_ATTEMPTS },
        },
        {
          status: "processing",
          leaseExpiresAt: { $lte: now },
          attempts: { $lt: OUTBOX_MAX_ATTEMPTS },
        },
      ],
    },
    {
      $set: {
        status: "processing",
        leaseExpiresAt: new Date(now.getTime() + OUTBOX_LEASE_MS),
      },
      $inc: { attempts: 1 },
    },
    { returnDocument: "after", runValidators: true }
  ).lean();

  if (!claimed) {
    const existing = await NotificationOutbox.findById(outboxId)
      .select("notification")
      .lean();
    if (existing?.notification) {
      return Notification.findById(existing.notification).lean();
    }
    return null;
  }

  try {
    const event = claimed.payload;
    const notification = await createInAppNotification(event);
    await enqueueCustomerDeliveries({
      userId: event.recipientId,
      eventType: event.type,
      deliveryKey: event.idempotencyKey,
      title: event.title,
      message: event.message,
      actionUrl: event.actionUrl,
      orderId: event.relatedOrder,
      promotional: event.type === "promotion",
    });
    await NotificationOutbox.updateOne(
      { _id: claimed._id, status: "processing" },
      {
        $set: {
          status: "completed",
          notification: notification?._id ?? null,
          completedAt: new Date(),
          leaseExpiresAt: null,
          lastError: null,
        },
      }
    );
    return notification;
  } catch (error) {
    const retryable = claimed.attempts < OUTBOX_MAX_ATTEMPTS;
    const delay = Math.min(
      1000 * 2 ** Math.max(0, claimed.attempts - 1),
      OUTBOX_MAX_RETRY_DELAY_MS
    );
    await NotificationOutbox.updateOne(
      { _id: claimed._id, status: "processing" },
      {
        $set: {
          status: retryable ? "pending" : "failed",
          nextAttemptAt: retryable
            ? new Date(Date.now() + delay)
            : null,
          leaseExpiresAt: null,
          lastError: String(error.message || "Outbox processing failed").slice(
            0,
            1000
          ),
        },
      }
    );
    console.error("Notification outbox event processing failed:", error.message);
    return null;
  }
};

export const listAdminNotificationOutbox = async ({
  page,
  limit,
  status,
}) => {
  const filter = status ? { status } : {};
  const skip = (page - 1) * limit;
  const [events, total] = await Promise.all([
    NotificationOutbox.find(filter)
      .select(
        "user eventKey status attempts nextAttemptAt lastError completedAt createdAt"
      )
      .sort({ createdAt: -1, _id: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),
    NotificationOutbox.countDocuments(filter),
  ]);
  return {
    events,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  };
};

export const retryFailedNotificationOutboxEvent = async (eventId) => {
  if (!isValidObjectId(String(eventId || ""))) {
    throw createError("Invalid notification outbox event ID.", 400);
  }
  const event = await NotificationOutbox.findOneAndUpdate(
    { _id: eventId, status: "failed" },
    {
      $set: {
        status: "pending",
        attempts: 0,
        nextAttemptAt: new Date(),
        leaseExpiresAt: null,
        lastError: null,
        completedAt: null,
      },
    },
    { returnDocument: "after", runValidators: true }
  );
  if (!event) {
    throw createError("Failed notification outbox event not found.", 404);
  }
  await processNotificationOutboxEvent(event._id);
  return NotificationOutbox.findById(event._id)
    .select("-payload")
    .lean();
};

const pollNotificationOutbox = async () => {
  if (
    outboxPollPromise ||
    NotificationOutbox.db.readyState !== 1 ||
    !outboxPollBackoff.shouldPoll()
  ) {
    return outboxPollPromise;
  }
  outboxPollPromise = (async () => {
    try {
      const now = new Date();
      await NotificationOutbox.updateMany(
        {
          attempts: { $gte: OUTBOX_MAX_ATTEMPTS },
          $or: [
            { status: "pending" },
            {
              status: "processing",
              leaseExpiresAt: { $lte: now },
            },
          ],
        },
        {
          $set: {
            status: "failed",
            leaseExpiresAt: null,
            nextAttemptAt: null,
            lastError:
              "Notification outbox lease expired after the maximum attempts.",
          },
        }
      );
      const events = await NotificationOutbox.find({
        attempts: { $lt: OUTBOX_MAX_ATTEMPTS },
        $or: [
          { status: "pending", nextAttemptAt: { $lte: now } },
          { status: "processing", leaseExpiresAt: { $lte: now } },
        ],
      })
        .sort({ createdAt: 1, _id: 1 })
        .limit(OUTBOX_BATCH_SIZE)
        .select("_id")
        .lean();
      for (const event of events) {
        await processNotificationOutboxEvent(event._id);
      }
      outboxPollBackoff.succeeded();
    } catch (error) {
      const retry = outboxPollBackoff.failed(error);
      if (retry.shouldLog) {
        console.error(
          `Notification outbox polling failed (attempt ${retry.attempt}; retry in ${Math.ceil(retry.delayMs / 1000)}s):`,
          error.message,
        );
      }
    } finally {
      outboxPollPromise = null;
    }
  })();
  return outboxPollPromise;
};

export const startNotificationOutboxWorker = () => {
  if (outboxTimer) {
    return;
  }
  outboxTimer = setInterval(() => {
    void pollNotificationOutbox();
  }, OUTBOX_POLL_INTERVAL_MS);
  outboxTimer.unref?.();
  void pollNotificationOutbox();
};

export const stopNotificationOutboxWorker = async () => {
  if (outboxTimer) {
    clearInterval(outboxTimer);
    outboxTimer = null;
  }
  await outboxPollPromise;
};

export const listNotifications = async (
  recipientType,
  recipientId,
  options = {}
) => {
  const recipient = getRecipient(recipientType, recipientId);
  const { page, limit } = parsePagination(options);
  const filter = { ...recipient };

  if (options.type) {
    if (!allowedTypes.includes(options.type)) {
      throw createError("Invalid notification type filter.", 400);
    }
    filter.type = options.type;
  }
  if (options.isRead !== undefined && options.isRead !== "") {
    if (!["true", "false", true, false].includes(options.isRead)) {
      throw createError("isRead must be true or false.", 400);
    }
    filter.isRead = options.isRead === true || options.isRead === "true";
  }

  const skip = (page - 1) * limit;
  const [notifications, total] = await Promise.all([
    Notification.find(filter)
      .sort({ createdAt: -1, _id: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),
    Notification.countDocuments(filter),
  ]);

  return {
    notifications,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  };
};

export const getUnreadNotificationCount = async (
  recipientType,
  recipientId
) => {
  const recipient = getRecipient(recipientType, recipientId);
  return Notification.countDocuments({
    ...recipient,
    isRead: false,
  });
};

export const markNotificationRead = async (
  recipientType,
  recipientId,
  notificationId
) => {
  const recipient = getRecipient(recipientType, recipientId);
  const id = validateObjectId(notificationId, "notification ID");
  const notification = await Notification.findOneAndUpdate(
    { _id: id, ...recipient, isRead: false },
    { $set: { isRead: true, readAt: new Date() } },
    { returnDocument: "after", runValidators: true }
  );
  if (notification) {
    return notification;
  }

  const alreadyRead = await Notification.findOne({
    _id: id,
    ...recipient,
  }).lean();
  if (alreadyRead) {
    return alreadyRead;
  }
  throw createError("Notification not found.", 404);
};

export const markAllNotificationsRead = async (
  recipientType,
  recipientId
) => {
  const recipient = getRecipient(recipientType, recipientId);
  const result = await Notification.updateMany(
    { ...recipient, isRead: false },
    { $set: { isRead: true, readAt: new Date() } }
  );
  return { modifiedCount: result.modifiedCount };
};

export const clearNotifications = async (recipientType, recipientId) => {
  const recipient = getRecipient(recipientType, recipientId);
  const result = await Notification.deleteMany(recipient);
  return { deletedCount: result.deletedCount };
};

const preferenceFields = [
  "inAppNotifications",
  "orderUpdates",
  "paymentUpdates",
  "shippingUpdates",
  "returnUpdates",
  "exchangeUpdates",
  "refundUpdates",
  "systemUpdates",
  "promotionalInApp",
  "promotionalEmail",
  "promotionalSms",
  "promotionalWhatsapp",
  "emailNotifications",
  "smsNotifications",
  "whatsappNotifications",
];

export const getNotificationPreferences = async (userId) => {
  const user = validateObjectId(userId, "customer ID");
  try {
    return await NotificationPreference.findOneAndUpdate(
      { user },
      { $setOnInsert: { user } },
      { returnDocument: "after", upsert: true, runValidators: true }
    );
  } catch (error) {
    if (error.code !== 11000) {
      throw error;
    }
    const existing = await NotificationPreference.findOne({
      user,
    }).lean();
    if (!existing) {
      throw error;
    }
    return existing;
  }
};

export const updateNotificationPreferences = async (
  userId,
  data
) => {
  const user = validateObjectId(userId, "customer ID");
  if (!data || typeof data !== "object" || Array.isArray(data)) {
    throw createError("Notification preferences must be an object.", 400);
  }
  const fields = Object.keys(data);
  if (
    fields.length === 0 ||
    fields.some((field) => !preferenceFields.includes(field))
  ) {
    throw createError(
      "Provide supported notification preference fields only.",
      400
    );
  }
  if (fields.some((field) => typeof data[field] !== "boolean")) {
    throw createError(
      "Notification preference values must be booleans.",
      400
    );
  }
  try {
    return await NotificationPreference.findOneAndUpdate(
      { user },
      { $set: data, $setOnInsert: { user } },
      { returnDocument: "after", upsert: true, runValidators: true }
    );
  } catch (error) {
    if (error.code !== 11000) {
      throw error;
    }
    return NotificationPreference.findOneAndUpdate(
      { user },
      { $set: data },
      { returnDocument: "after", runValidators: true }
    );
  }
};
