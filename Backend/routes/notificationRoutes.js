import { Router } from "express";

import {
  getCustomerNotificationPreferencesController,
  getCustomerUnreadNotificationCountController,
  clearCustomerNotificationsController,
  listCustomerNotificationsController,
  markAllCustomerNotificationsReadController,
  markCustomerNotificationReadController,
  updateCustomerNotificationPreferencesController,
} from "../controllers/notificationController.js";
import authMiddleware from "../middlewares/authMiddleware.js";
import validate from "../middlewares/validateMiddleware.js";
import { notificationPreferenceSchema } from "../validations/notificationValidation.js";

const router = Router();

router.use(authMiddleware);

router.get("/", listCustomerNotificationsController);
router.get("/unread-count", getCustomerUnreadNotificationCountController);
router.patch("/read-all", markAllCustomerNotificationsReadController);
router.delete("/", clearCustomerNotificationsController);
router.get("/preferences", getCustomerNotificationPreferencesController);
router.patch(
  "/preferences",
  validate(notificationPreferenceSchema),
  updateCustomerNotificationPreferencesController
);
router.patch("/:notificationId/read", markCustomerNotificationReadController);

export default router;
