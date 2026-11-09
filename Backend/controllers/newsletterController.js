import { createHash } from "node:crypto";
import { getPublicStoreDetails } from "../service/storeSettingsService.js";
import { renderBrandedEmail, sendTransactionalEmail } from "../service/emailService.js";
import { subscribeToNewsletter } from "../service/newsletterService.js";

export const subscribeToNewsletterController = async (req, res, next) => {
  const email = req.validatedBody.email.trim().toLowerCase();

  try {
    await subscribeToNewsletter(email);
  } catch (error) {
    return next(error);
  }

  try {
    const { supportEmail } = await getPublicStoreDetails();
    if (!supportEmail) {
      const error = new Error("Newsletter notifications are not configured for this store.");
      error.statusCode = 503;
      throw error;
    }

    await sendTransactionalEmail({
      to: supportEmail,
      replyTo: email,
      subject: "New Nishree Attire newsletter subscriber",
      text: `A visitor subscribed to Nishree Attire email updates.\n\nEmail: ${email}\nConsent: explicitly accepted on the website.`,
      html: renderBrandedEmail({
        title: "A new reader joined the list",
        preheader: "A visitor subscribed to Nishree Attire email updates.",
        body: `Email: ${email}\nConsent: explicitly accepted on the website.`,
      }),
      idempotencyKey: `newsletter-${createHash("sha256").update(email).digest("hex")}`,
    });
  } catch (error) {
    if (error.code === "RESEND_CONFIG_MISSING") {
      error.statusCode = 503;
      error.message = "Your subscription was saved, but email notification is not configured for this store.";
    } else {
      error.statusCode = 503;
      error.message = "Your subscription was saved, but the store team could not be notified. Please try again later.";
    }
    return next(error);
  }

  return res.status(200).json({
    success: true,
    message: "You are subscribed to Nishree Attire updates.",
  });
};
