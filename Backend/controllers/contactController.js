import { getPublicStoreDetails } from "../service/storeSettingsService.js";
import { renderBrandedEmail, sendTransactionalEmail } from "../service/emailService.js";

export const submitContactMessageController = async (req, res, next) => {
  try {
    const { fullName, email, subject, message } = req.validatedBody;
    const settings = await getPublicStoreDetails();
    if (!settings.supportEmail) {
      const error = new Error("Contact email is not configured for this store.");
      error.statusCode = 503;
      throw error;
    }

    const text = [
      "A customer sent a message through the Nishree Attire contact form.",
      "",
      `Name: ${fullName}`,
      `Email: ${email}`,
      `Subject: ${subject}`,
      "",
      message,
    ].join("\n");

    await sendTransactionalEmail({
      to: settings.supportEmail,
      replyTo: email,
      subject: `Website contact: ${subject}`,
      text,
      html: renderBrandedEmail({
        title: "New customer message",
        preheader: "A new message was submitted through the Nishree Attire website.",
        body: `From: ${fullName}\nReply to: ${email}\nSubject: ${subject}\n\n${message}`,
      }),
    });

    return res.status(200).json({
      success: true,
      message: "Your message has been sent. Our team will be in touch.",
    });
  } catch (error) {
    if (error.code === "SMTP_CONFIG_MISSING") {
      error.statusCode = 503;
      error.message = "Contact email delivery is not configured. Please use the listed support contact.";
    }
    return next(error);
  }
};
