import {
  processMetaNotificationWebhook,
  processTwilioNotificationWebhook,
  verifyMetaWebhookToken,
} from "../service/notificationDeliveryWebhookService.js";

export const twilioNotificationWebhookController = async (
  req,
  res,
  next
) => {
  try {
    await processTwilioNotificationWebhook({
      signature: req.get("X-Twilio-Signature"),
      originalUrl: req.originalUrl,
      parameters: req.body,
    });
    return res.status(200).type("text/xml").send("<Response/>");
  } catch (error) {
    return next(error);
  }
};

export const metaNotificationWebhookVerificationController = (
  req,
  res
) => {
  const mode = req.query["hub.mode"];
  const token = req.query["hub.verify_token"];
  const challenge = req.query["hub.challenge"];
  if (
    mode === "subscribe" &&
    verifyMetaWebhookToken(token) &&
    typeof challenge === "string"
  ) {
    return res.status(200).type("text/plain").send(challenge);
  }
  return res.status(403).end();
};

export const metaNotificationWebhookController = async (
  req,
  res,
  next
) => {
  try {
    const result = await processMetaNotificationWebhook({
      rawBody: req.rawBody,
      signature: req.get("X-Hub-Signature-256"),
    });
    return res.status(200).json({ success: true, data: result });
  } catch (error) {
    return next(error);
  }
};
