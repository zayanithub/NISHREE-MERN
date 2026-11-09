import assert from "node:assert/strict";
import test from "node:test";
import Newsletter from "../models/Newsletter.js";
import StoreSettings from "../models/StoreSettings.js";
import { subscribeToNewsletterController } from "../controllers/newsletterController.js";
import { subscribeToNewsletter } from "../service/newsletterService.js";
import { newsletterSubscriptionSchema } from "../validations/newsletterValidation.js";

test("newsletter subscriptions require a valid email and explicit consent", () => {
  assert.equal(
    newsletterSubscriptionSchema.safeParse({
      email: "reader@example.test",
      consent: true,
    }).success,
    true
  );
  assert.equal(
    newsletterSubscriptionSchema.safeParse({
      email: "not-an-email",
      consent: true,
    }).success,
    false
  );
  assert.equal(
    newsletterSubscriptionSchema.safeParse({
      email: "reader@example.test",
      consent: false,
    }).success,
    false
  );
});

test("newsletter subscription stores normalized email and consent without exposing it", async (t) => {
  let update;
  t.mock.method(Newsletter, "findOneAndUpdate", async (...args) => {
    update = args;
    return {};
  });

  const result = await subscribeToNewsletter(" Reader@Example.Test ");

  assert.deepEqual(result, { subscribed: true });
  assert.deepEqual(update[0], { email: "reader@example.test" });
  assert.equal(update[1].$set.status, "subscribed");
  assert.equal(update[1].$set.source, "website");
  assert.equal(update[1].$set.email, undefined);
  assert.equal(update[1].$setOnInsert.email, "reader@example.test");
  assert.ok(update[1].$set.consentAt instanceof Date);
  assert.equal(update[2].upsert, true);
  assert.equal(update[2].runValidators, true);
});

test("newsletter signup notifies the configured support inbox after saving consent", async (t) => {
  const previousEnv = {
    RESEND_API_KEY: process.env.RESEND_API_KEY,
    EMAIL_FROM: process.env.EMAIL_FROM,
  };
  process.env.RESEND_API_KEY = "re_newsletter_test";
  process.env.EMAIL_FROM = "onboarding@resend.dev";
  t.after(() => {
    for (const [key, value] of Object.entries(previousEnv)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  });

  let storedSubscription;
  t.mock.method(Newsletter, "findOneAndUpdate", async (...args) => {
    storedSubscription = args;
    return {};
  });
  t.mock.method(StoreSettings, "findOne", () => ({
    lean: async () => ({ supportEmail: "store@example.test" }),
  }));

  let emailRequest;
  t.mock.method(globalThis, "fetch", async (url, options) => {
    emailRequest = { url, options };
    return new Response(JSON.stringify({ id: "newsletter-message-1" }), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  });
  t.mock.method(console, "info", () => {});

  let responseStatus;
  let responseBody;
  let nextError;
  const response = {
    status(value) { responseStatus = value; return this; },
    json(value) { responseBody = value; return this; },
  };

  await subscribeToNewsletterController({
    validatedBody: { email: "Reader@Example.Test", consent: true },
  }, response, (error) => { nextError = error; });

  assert.equal(nextError, undefined);
  assert.equal(responseStatus, 200);
  assert.equal(responseBody.success, true);
  assert.deepEqual(storedSubscription[0], { email: "reader@example.test" });
  assert.equal(storedSubscription[1].$set.status, "subscribed");
  assert.equal(storedSubscription[1].$set.source, "website");
  assert.equal(emailRequest.url, "https://api.resend.com/emails");

  const deliveredEmail = JSON.parse(emailRequest.options.body);
  assert.equal(deliveredEmail.to, "store@example.test");
  assert.equal(deliveredEmail.reply_to, "reader@example.test");
  assert.match(deliveredEmail.text, /reader@example\.test/);
  assert.match(deliveredEmail.text, /Consent: explicitly accepted/);
  assert.match(emailRequest.options.headers.get("idempotency-key"), /^newsletter-[a-f0-9]{64}$/);
});

test("newsletter signup reports notification failure after preserving the subscription", async (t) => {
  const previousEnv = {
    RESEND_API_KEY: process.env.RESEND_API_KEY,
    EMAIL_FROM: process.env.EMAIL_FROM,
  };
  delete process.env.RESEND_API_KEY;
  delete process.env.EMAIL_FROM;
  t.after(() => {
    for (const [key, value] of Object.entries(previousEnv)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  });

  let saved = false;
  t.mock.method(Newsletter, "findOneAndUpdate", async () => {
    saved = true;
    return {};
  });
  t.mock.method(StoreSettings, "findOne", () => ({
    lean: async () => ({ supportEmail: "store@example.test" }),
  }));

  let responseStatus;
  let nextError;
  const response = { status(value) { responseStatus = value; return this; } };
  await subscribeToNewsletterController({
    validatedBody: { email: "reader@example.test", consent: true },
  }, response, (error) => { nextError = error; });

  assert.equal(saved, true);
  assert.equal(responseStatus, undefined);
  assert.equal(nextError.statusCode, 503);
  assert.match(nextError.message, /subscription was saved/i);
});
