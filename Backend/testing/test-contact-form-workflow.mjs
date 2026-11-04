import test from "node:test";
import assert from "node:assert/strict";
import nodemailer from "nodemailer";
import StoreSettings from "../models/StoreSettings.js";
import { submitContactMessageController } from "../controllers/contactController.js";
import { contactMessageSchema } from "../validations/contactValidation.js";

test("contact form validates fields and sends only to the configured store support email", async (t) => {
  const envKeys = ["SMTP_HOST", "SMTP_PORT", "SMTP_SECURE", "SMTP_USER", "SMTP_PASS"];
  const previousEnv = Object.fromEntries(envKeys.map((key) => [key, process.env[key]]));
  Object.assign(process.env, {
    SMTP_HOST: "smtp.example.test",
    SMTP_PORT: "465",
    SMTP_SECURE: "true",
    SMTP_USER: "sender@example.test",
    SMTP_PASS: "smtp-test-password",
  });
  t.after(() => {
    for (const [key, value] of Object.entries(previousEnv)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  });

  assert.equal(contactMessageSchema.safeParse({
    fullName: "A",
    email: "not-an-email",
    subject: "Hi",
    message: "short",
  }).success, false);

  let sentMessage;
  t.mock.method(StoreSettings, "findOne", () => ({
    lean: async () => ({ supportEmail: "configured@nishree.example" }),
  }));
  t.mock.method(nodemailer, "createTransport", () => ({
    sendMail: async (message) => {
      sentMessage = message;
      return { messageId: "contact-message-1" };
    },
  }));

  let responseStatus;
  let responseBody;
  const response = {
    status(value) { responseStatus = value; return this; },
    json(value) { responseBody = value; return this; },
  };
  let nextError;
  await submitContactMessageController({
    validatedBody: {
      fullName: "Nishree Customer",
      email: "customer@example.test",
      subject: "Order question",
      message: "Could you please help me with my recent order?",
    },
  }, response, (error) => { nextError = error; });

  assert.equal(nextError, undefined);
  assert.equal(responseStatus, 200);
  assert.equal(responseBody.success, true);
  assert.equal(sentMessage.to, "configured@nishree.example");
  assert.equal(sentMessage.replyTo, "customer@example.test");
  assert.match(sentMessage.text, /Nishree Customer/);
  assert.match(sentMessage.text, /recent order/);
});
