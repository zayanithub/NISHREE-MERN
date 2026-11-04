import { Router } from "express";

import {
  getAdminUnreadNotificationCountController,
  listAdminNotificationsController,
  markAdminNotificationReadController,
  markAllAdminNotificationsReadController,
  listAdminNotificationDeliveriesController,
  retryAdminNotificationDeliveryController,
  listAdminNotificationTemplatesController,
  upsertAdminNotificationTemplateController,
  listAdminNotificationOutboxController,
  retryAdminNotificationOutboxEventController,
} from "../../controllers/notificationController.js";
import adminAuthMiddleware from "../../middlewares/adminAuthMiddleware.js";
import requirePermission from "../../middlewares/requirePermission.js";
import validate from "../../middlewares/validateMiddleware.js";
import {
  notificationRetrySchema,
  notificationTemplateSchema,
} from "../../validations/notificationValidation.js";

const router = Router();

router.use(adminAuthMiddleware);

router.get(
  "/outbox",
  requirePermission("notifications", "read"),
  listAdminNotificationOutboxController
);
router.post(
  "/outbox/:eventId/retry",
  requirePermission("notifications", "update"),
  retryAdminNotificationOutboxEventController
);
router.get(
  "/templates",
  requirePermission("notifications", "read"),
  listAdminNotificationTemplatesController
);
router.put(
  "/templates/:key/:channel",
  requirePermission("notifications", "update"),
  validate(notificationTemplateSchema),
  upsertAdminNotificationTemplateController
);
router.get(
  "/deliveries",
  requirePermission("notifications", "read"),
  listAdminNotificationDeliveriesController
);
router.post(
  "/deliveries/:deliveryId/retry",
  requirePermission("notifications", "update"),
  validate(notificationRetrySchema),
  retryAdminNotificationDeliveryController
);
router.get(
  "/",
  requirePermission("notifications", "read"),
  listAdminNotificationsController
);
router.get(
  "/unread-count",
  requirePermission("notifications", "read"),
  getAdminUnreadNotificationCountController
);
router.patch(
  "/read-all",
  requirePermission("notifications", "update"),
  markAllAdminNotificationsReadController
);
router.patch(
  "/:notificationId/read",
  requirePermission("notifications", "update"),
  markAdminNotificationReadController
);

export default router;
