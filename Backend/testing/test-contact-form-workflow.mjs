import test from "node:test";
import assert from "node:assert/strict";
import StoreSettings from "../models/StoreSettings.js";
import { submitContactMessageController } from "../controllers/contactController.js";
import { contactMessageSchema } from "../validations/contactValidation.js";

test("contact form validates fields and sends only to the configured store support email", async (t) => {
  const envKeys = ["RESEND_API_KEY", "EMAIL_FROM"];
  const previousEnv = Object.fromEntries(envKeys.map((key) => [key, process.env[key]]));
  Object.assign(process.env, {
    RESEND_API_KEY: "re_contact_test",
    EMAIL_FROM: "onboarding@resend.dev",
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
  t.mock.method(globalThis, "fetch", async (_url, options) => {
    sentMessage = JSON.parse(options.body);
    return new Response(JSON.stringify({ id: "contact-message-1" }), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  });
  t.mock.method(console, "info", () => {});

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
  assert.equal(sentMessage.reply_to, "customer@example.test");
  assert.match(sentMessage.text, /Nishree Customer/);
  assert.match(sentMessage.text, /recent order/);
});
