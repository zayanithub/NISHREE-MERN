import "dotenv/config";

import {
  createHmac,
  randomUUID,
} from "node:crypto";

/*
|--------------------------------------------------------------------------
| Local Razorpay Webhook Signature Test
|--------------------------------------------------------------------------
|
| This test sends a locally generated, correctly signed
| test event. It does not create a real Razorpay payment.
|
| It verifies:
| 1. Raw-body signature verification.
| 2. Valid signature acceptance.
| 3. Duplicate event detection.
|--------------------------------------------------------------------------
*/

const webhookSecret =
  process.env.RAZORPAY_WEBHOOK_SECRET;

if (!webhookSecret) {
  console.error(
    "RAZORPAY_WEBHOOK_SECRET is missing from .env"
  );

  process.exit(1);
}

const endpoint =
  process.env.RAZORPAY_WEBHOOK_TEST_URL ||
  "http://localhost:5000/api/v1/payments/razorpay/webhook";

/*
 * Use an intentionally unsupported event type.
 * The webhook service should acknowledge it without
 * changing any payment or order.
 */
const rawBody = Buffer.from(
  JSON.stringify({
    event: "test.webhook",
    payload: {},
  }),
  "utf8"
);

/*
 * Generate a valid HMAC SHA-256 signature over
 * the exact bytes sent in the HTTP request.
 */
const signature = createHmac(
  "sha256",
  webhookSecret
)
  .update(rawBody)
  .digest("hex");

const eventId = `local-test-${randomUUID()}`;

const headers = {
  "Content-Type": "application/json",
  "X-Razorpay-Signature": signature,
  "x-razorpay-event-id": eventId,
};

const sendWebhook = async () => {
  const response = await fetch(endpoint, {
    method: "POST",
    headers,
    body: rawBody,
  });

  const responseText = await response.text();

  let data;

  try {
    data = JSON.parse(responseText);
  } catch {
    data = {
      message: responseText,
    };
  }

  return {
    status: response.status,
    data,
  };
};

try {
  // First delivery.
  const first = await sendWebhook();

  console.log(
    "First delivery:",
    JSON.stringify(first, null, 2)
  );

  if (
    first.status !== 200 ||
    first.data.success !== true ||
    first.data.duplicate !== false
  ) {
    throw new Error(
      "First signed webhook did not process as expected."
    );
  }

  // Repeat the identical event with the same event ID.
  const second = await sendWebhook();

  console.log(
    "Duplicate delivery:",
    JSON.stringify(second, null, 2)
  );

  if (
    second.status !== 200 ||
    second.data.success !== true ||
    second.data.duplicate !== true
  ) {
    throw new Error(
      "Duplicate webhook was not detected correctly."
    );
  }

  console.log(
    "PASS: Valid signature accepted; duplicate webhook detected."
  );
} catch (error) {
  console.error(
    "Webhook test failed:",
    error.message
  );

  process.exitCode = 1;
}