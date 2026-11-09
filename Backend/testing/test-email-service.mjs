import test from "node:test";
import assert from "node:assert/strict";

import {
  getEmailDeliveryErrorDetails,
  sendTransactionalEmail,
} from "../service/emailService.js";

const EMAIL_ENV_KEYS = ["RESEND_API_KEY", "EMAIL_FROM"];
const originalEnv = Object.fromEntries(
  EMAIL_ENV_KEYS.map((key) => [key, process.env[key]])
);

test.beforeEach(() => {
  process.env.RESEND_API_KEY = "re_test_secret";
  process.env.EMAIL_FROM = "onboarding@resend.dev";
});

test.after(() => {
  for (const [key, value] of Object.entries(originalEnv)) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
});

test("sends a validated message to Resend over HTTPS and tracks its message ID", async (t) => {
  let request;
  t.mock.method(globalThis, "fetch", async (url, options) => {
    request = { url, options };
    return new Response(JSON.stringify({ id: "resend-message-1" }), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  });
  t.mock.method(console, "info", () => {});

  const result = await sendTransactionalEmail({
    to: "customer@example.test",
    subject: "Account verification",
    text: "Your verification code is ready.",
    html: "<p>Your verification code is ready.</p>",
    replyTo: "support@example.test",
    idempotencyKey: "notification-123",
  });

  assert.deepEqual(result, {
    accepted: true,
    messageId: "resend-message-1",
  });
  assert.equal(request.url, "https://api.resend.com/emails");
  assert.equal(request.options.method, "POST");
  assert.equal(
    request.options.headers.get("authorization"),
    "Bearer re_test_secret"
  );
  assert.equal(
    request.options.headers.get("idempotency-key"),
    "notification-123"
  );
  assert.ok(request.options.signal instanceof AbortSignal);
  assert.deepEqual(JSON.parse(request.options.body), {
    from: "onboarding@resend.dev",
    to: "customer@example.test",
    subject: "Account verification",
    text: "Your verification code is ready.",
    html: "<p>Your verification code is ready.</p>",
    reply_to: "support@example.test",
  });
});

test("rejects malformed or unsafe email payloads before making a provider request", async (t) => {
  t.mock.method(globalThis, "fetch", () => {
    assert.fail("Invalid email payloads must not be sent");
  });

  for (const payload of [
    { to: "bad recipient", subject: "Subject", text: "Body" },
    { to: "customer@example.test", subject: "Bad\r\nBcc: other@example.test", text: "Body" },
    { to: "customer@example.test", subject: "Subject", text: " " },
    { to: "customer@example.test", subject: "Subject", html: "<p>Body</p>", replyTo: "invalid" },
    { to: ["customer@example.test", "other@example.test"], subject: "Subject", text: "Body" },
  ]) {
    await assert.rejects(sendTransactionalEmail(payload), {
      code: "EMAIL_PAYLOAD_INVALID",
      statusCode: 400,
      retryable: false,
    });
  }
});

test("fails safely when required Resend settings are missing", async (t) => {
  delete process.env.RESEND_API_KEY;
  t.mock.method(globalThis, "fetch", () => {
    assert.fail("Missing configuration must not make a provider request");
  });

  await assert.rejects(
    sendTransactionalEmail({
      to: "customer@example.test",
      subject: "Subject",
      text: "Body",
    }),
    {
      code: "RESEND_CONFIG_MISSING",
      statusCode: 503,
      message: "Email delivery is not configured.",
    }
  );
});

test("classifies invalid API keys without exposing provider details", async (t) => {
  t.mock.method(globalThis, "fetch", async () =>
    new Response(
      JSON.stringify({
        statusCode: 401,
        message: "sensitive provider detail with re_live_secret",
        name: "validation_error",
      }),
      { status: 401, headers: { "content-type": "application/json" } }
    )
  );
  t.mock.method(console, "error", () => {});

  await assert.rejects(
    sendTransactionalEmail({
      to: "customer@example.test",
      subject: "Subject",
      text: "Body",
    }),
    (error) => {
      assert.equal(error.code, "RESEND_API_KEY_INVALID");
      assert.equal(error.statusCode, 503);
      assert.equal(error.providerStatusCode, 401);
      assert.equal(error.retryable, false);
      assert.equal(error.outcomeUnknown, false);
      assert.doesNotMatch(error.message, /sensitive|re_live_secret/);
      assert.equal(
        getEmailDeliveryErrorDetails(error).category,
        "configuration"
      );
      assert.equal(
        getEmailDeliveryErrorDetails(error).providerStatusCode,
        401
      );
      return true;
    }
  );
});

test("identifies sender or recipient authorization failures separately from API key errors", async (t) => {
  t.mock.method(globalThis, "fetch", async () =>
    new Response(
      JSON.stringify({
        statusCode: 403,
        message:
          "You can only send testing emails to your own email address.",
        name: "validation_error",
      }),
      { status: 403, headers: { "content-type": "application/json" } }
    )
  );
  t.mock.method(console, "error", () => {});

  await assert.rejects(
    sendTransactionalEmail({
      to: "customer@example.test",
      subject: "Subject",
      text: "Body",
    }),
    (error) => {
      assert.equal(error.code, "RESEND_SENDER_REJECTED");
      assert.equal(error.statusCode, 503);
      assert.equal(error.providerStatusCode, 403);
      assert.equal(error.retryable, false);
      assert.match(error.message, /verified sending domain/);
      assert.doesNotMatch(error.message, /own email address/);
      const details = getEmailDeliveryErrorDetails(error);
      assert.equal(details.category, "configuration");
      assert.equal(details.providerStatusCode, 403);
      return true;
    }
  );
});

test("marks rate limits and provider outages as retryable", async (t) => {
  t.mock.method(globalThis, "fetch", async () =>
    new Response(
      JSON.stringify({
        statusCode: 429,
        message: "Rate limited",
        name: "rate_limit_exceeded",
      }),
      { status: 429, headers: { "content-type": "application/json" } }
    )
  );
  t.mock.method(console, "error", () => {});

  await assert.rejects(
    sendTransactionalEmail({
      to: "customer@example.test",
      subject: "Subject",
      text: "Body",
    }),
    {
      code: "RESEND_RATE_LIMITED",
      statusCode: 503,
      retryable: true,
      outcomeUnknown: false,
    }
  );
});

test("does not automatically retry when the provider outcome is unknown", async (t) => {
  t.mock.method(globalThis, "fetch", async () => {
    throw new TypeError("network failure containing private data");
  });
  t.mock.method(console, "error", () => {});

  await assert.rejects(
    sendTransactionalEmail({
      to: "customer@example.test",
      subject: "Subject",
      text: "Body",
    }),
    (error) => {
      assert.equal(error.code, "RESEND_OUTCOME_UNKNOWN");
      assert.equal(error.retryable, false);
      assert.equal(error.outcomeUnknown, true);
      assert.doesNotMatch(error.message, /private data/);
      return true;
    }
  );
});
