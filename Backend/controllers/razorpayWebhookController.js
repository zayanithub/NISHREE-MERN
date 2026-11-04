import {
  processRazorpayWebhook as processRazorpayWebhookService,
} from "../service/razorpayWebhookService.js";

/*
|--------------------------------------------------------------------------
| Razorpay Webhook Controller
|--------------------------------------------------------------------------
|
| Receives Razorpay webhook events and forwards them to
| the service for signature verification and processing.
|
| This endpoint must NOT use customer/admin JWT authentication.
| Authenticity is verified using:
|
|   1. X-Razorpay-Signature
|   2. X-Razorpay-Event-Id
|   3. The original raw request body
|--------------------------------------------------------------------------
*/

export const razorpayWebhookController = async (
  req,
  res,
  next
) => {
  try {
    const rawBody = req.rawBody;

    const signature = req.get(
      "X-Razorpay-Signature"
    );

    const eventId = req.get(
      "x-razorpay-event-id"
    );

    const result =
      await processRazorpayWebhookService({
        rawBody,
        signature,
        eventId,
      });

    return res.status(200).json({
      success: true,
      message: result.duplicate
        ? "Webhook event was already processed."
        : "Webhook event processed successfully.",
      ...result,
    });
  } catch (error) {
    return next(error);
  }
};