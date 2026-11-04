import { Router } from "express";

import {
  metaNotificationWebhookController,
  metaNotificationWebhookVerificationController,
  twilioNotificationWebhookController,
} from "../controllers/notificationDeliveryWebhookController.js";

const router = Router();

router.post("/twilio", twilioNotificationWebhookController);
router.get(
  "/meta",
  metaNotificationWebhookVerificationController
);
router.post("/meta", metaNotificationWebhookController);

export default router;
