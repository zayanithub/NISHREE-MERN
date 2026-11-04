import {
  getNotificationPreferences,
  getUnreadNotificationCount,
  clearNotifications,
  listNotifications,
  markAllNotificationsRead,
  markNotificationRead,
  updateNotificationPreferences,
} from "../service/notificationService.js";
import {
  listAdminNotificationTemplates,
  listAdminNotificationDeliveries,
  retryNotificationDelivery,
  upsertAdminNotificationTemplate,
} from "../service/notificationDeliveryService.js";
import {
  listAdminNotificationOutbox,
  retryFailedNotificationOutboxEvent,
} from "../service/notificationService.js";
import { notificationOutboxQuerySchema } from "../validations/notificationValidation.js";

export const listCustomerNotificationsController = async (
  req,
  res,
  next
) => {
  try {
    const result = await listNotifications(
      "user",
      req.auth?.userId,
      req.query
    );
    return res.status(200).json({
      success: true,
      message: "Notifications retrieved successfully.",
      data: result,
    });
  } catch (error) {
    return next(error);
  }
};

export const getCustomerUnreadNotificationCountController = async (
  req,
  res,
  next
) => {
  try {
    const unreadCount = await getUnreadNotificationCount(
      "user",
      req.auth?.userId
    );
    return res.status(200).json({
      success: true,
      message: "Unread notification count retrieved successfully.",
      data: { unreadCount },
    });
  } catch (error) {
    return next(error);
  }
};

export const markCustomerNotificationReadController = async (
  req,
  res,
  next
) => {
  try {
    const notification = await markNotificationRead(
      "user",
      req.auth?.userId,
      req.params.notificationId
    );
    return res.status(200).json({
      success: true,
      message: "Notification marked as read.",
      data: { notification },
    });
  } catch (error) {
    return next(error);
  }
};

export const markAllCustomerNotificationsReadController = async (
  req,
  res,
  next
) => {
  try {
    const result = await markAllNotificationsRead(
      "user",
      req.auth?.userId
    );
    return res.status(200).json({
      success: true,
      message: "Notifications marked as read.",
      data: result,
    });
  } catch (error) {
    return next(error);
  }
};

export const clearCustomerNotificationsController = async (req, res, next) => {
  try {
    const result = await clearNotifications("user", req.auth?.userId);
    return res.status(200).json({
      success: true,
      message: "Notifications cleared successfully.",
      data: result,
    });
  } catch (error) {
    return next(error);
  }
};

export const getCustomerNotificationPreferencesController = async (
  req,
  res,
  next
) => {
  try {
    const preferences = await getNotificationPreferences(
      req.auth?.userId
    );
    return res.status(200).json({
      success: true,
      message: "Notification preferences retrieved successfully.",
      data: { preferences },
    });
  } catch (error) {
    return next(error);
  }
};

export const updateCustomerNotificationPreferencesController = async (
  req,
  res,
  next
) => {
  try {
    const preferences = await updateNotificationPreferences(
      req.auth?.userId,
      req.validatedBody
    );
    return res.status(200).json({
      success: true,
      message: "Notification preferences updated successfully.",
      data: { preferences },
    });
  } catch (error) {
    return next(error);
  }
};

export const listAdminNotificationsController = async (
  req,
  res,
  next
) => {
  try {
    const result = await listNotifications(
      "adminUser",
      req.admin?.adminId,
      req.query
    );
    return res.status(200).json({
      success: true,
      message: "Admin notifications retrieved successfully.",
      data: result,
    });
  } catch (error) {
    return next(error);
  }
};

export const getAdminUnreadNotificationCountController = async (
  req,
  res,
  next
) => {
  try {
    const unreadCount = await getUnreadNotificationCount(
      "adminUser",
      req.admin?.adminId
    );
    return res.status(200).json({
      success: true,
      message: "Unread notification count retrieved successfully.",
      data: { unreadCount },
    });
  } catch (error) {
    return next(error);
  }
};

export const markAdminNotificationReadController = async (
  req,
  res,
  next
) => {
  try {
    const notification = await markNotificationRead(
      "adminUser",
      req.admin?.adminId,
      req.params.notificationId
    );
    return res.status(200).json({
      success: true,
      message: "Notification marked as read.",
      data: { notification },
    });
  } catch (error) {
    return next(error);
  }
};

export const markAllAdminNotificationsReadController = async (
  req,
  res,
  next
) => {
  try {
    const result = await markAllNotificationsRead(
      "adminUser",
      req.admin?.adminId
    );
    return res.status(200).json({
      success: true,
      message: "Notifications marked as read.",
      data: result,
    });
  } catch (error) {
    return next(error);
  }
};

export const listAdminNotificationDeliveriesController = async (
  req,
  res,
  next
) => {
  try {
    const result = await listAdminNotificationDeliveries(req.query);
    return res.status(200).json({
      success: true,
      message: "Notification delivery logs retrieved successfully.",
      data: result,
    });
  } catch (error) {
    return next(error);
  }
};

export const retryAdminNotificationDeliveryController = async (
  req,
  res,
  next
) => {
  try {
    const delivery = await retryNotificationDelivery(
      req.params.deliveryId,
      req.admin?.adminId,
      req.validatedBody?.confirmUnknownOutcome
    );
    return res.status(200).json({
      success: true,
      message: "Failed notification delivery queued for retry.",
      data: { delivery },
    });
  } catch (error) {
    return next(error);
  }
};

export const listAdminNotificationTemplatesController = async (
  req,
  res,
  next
) => {
  try {
    const templates = await listAdminNotificationTemplates();
    return res.status(200).json({
      success: true,
      message: "Notification templates retrieved successfully.",
      data: { templates },
    });
  } catch (error) {
    return next(error);
  }
};

export const upsertAdminNotificationTemplateController = async (
  req,
  res,
  next
) => {
  try {
    const template = await upsertAdminNotificationTemplate(
      req.admin?.adminId,
      req.params.key,
      req.params.channel,
      req.validatedBody
    );
    return res.status(200).json({
      success: true,
      message: "Notification template saved successfully.",
      data: { template },
    });
  } catch (error) {
    return next(error);
  }
};

export const listAdminNotificationOutboxController = async (
  req,
  res,
  next
) => {
  try {
    const parsed = notificationOutboxQuerySchema.safeParse(req.query);
    if (!parsed.success) {
      const error = new Error(
        parsed.error.issues.map((issue) => issue.message).join("; ")
      );
      error.statusCode = 400;
      throw error;
    }
    const data = await listAdminNotificationOutbox(parsed.data);
    return res.status(200).json({
      success: true,
      message: "Notification outbox events retrieved successfully.",
      data,
    });
  } catch (error) {
    return next(error);
  }
};

export const retryAdminNotificationOutboxEventController = async (
  req,
  res,
  next
) => {
  try {
    const event = await retryFailedNotificationOutboxEvent(
      req.params.eventId
    );
    return res.status(200).json({
      success: true,
      message: "Notification outbox event replay requested successfully.",
      data: { event },
    });
  } catch (error) {
    return next(error);
  }
};
