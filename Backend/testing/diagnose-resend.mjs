import "dotenv/config";
import { randomUUID } from "node:crypto";
import {
  getEmailDeliveryErrorDetails,
  sendTransactionalEmail,
} from "../service/emailService.js";

const sendTestEmail = process.argv.includes("--send-test-email");

if (!sendTestEmail) {
  console.log(
    JSON.stringify({
      provider: "resend",
      apiKeyConfigured: Boolean(process.env.RESEND_API_KEY),
      senderConfigured: Boolean(process.env.EMAIL_FROM),
      testEmailSent: false,
      instruction:
        "Set RESEND_DIAGNOSTIC_ENV=staging and RESEND_DIAGNOSTIC_TO, then pass --send-test-email to send a staging test.",
    })
  );
  process.exit(0);
}

if (
  process.env.RESEND_DIAGNOSTIC_ENV !== "staging" ||
  !process.env.RESEND_DIAGNOSTIC_TO
) {
  console.error(
    "Test sending requires RESEND_DIAGNOSTIC_ENV=staging and RESEND_DIAGNOSTIC_TO."
  );
  process.exit(1);
}

try {
  const result = await sendTransactionalEmail({
    to: process.env.RESEND_DIAGNOSTIC_TO,
    subject: "Nishree Attire staging email API test",
    text: "This staging-only message tests the Resend email API integration.",
    html: "<p>This staging-only message tests the Resend email API integration.</p>",
    idempotencyKey: `diagnostic-${randomUUID()}`,
  });
  console.log(
    JSON.stringify({
      provider: "resend",
      accepted: result.accepted,
      messageId: result.messageId,
      note: "Provider acceptance does not confirm inbox delivery.",
    })
  );
} catch (error) {
  console.error(
    JSON.stringify({
      provider: "resend",
      testEmailSent: false,
      ...getEmailDeliveryErrorDetails(error),
    })
  );
  process.exitCode = 1;
}
