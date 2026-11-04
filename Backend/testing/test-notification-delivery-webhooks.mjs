import test from "node:test";
import assert from "node:assert/strict";
import { createHmac } from "node:crypto";

import NotificationLog from "../models/NotificationLog.js";
import NotificationPreference from "../models/NotificationPreference.js";
import User from "../models/User.js";
import {
  processMetaNotificationWebhook,
  processTwilioNotificationWebhook,
  verifyMetaWebhookToken,
  verifyMetaWebhookSignature,
} from "../service/notificationDeliveryWebhookService.js";

const USER_ID = "507f1f77bcf86cd799439011";
const DELIVERY_ID = "507f1f77bcf86cd799439012";

const withEnvironment = (t, values) => {
  const prior = Object.fromEntries(
    Object.keys(values).map((key) => [key, process.env[key]])
  );
  Object.assign(process.env, values);
  t.after(() => {
    for (const [key, value] of Object.entries(prior)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  });
};

const signTwilioRequest = (token, url, parameters) => {
  const signedData =
    url +
    Object.keys(parameters)
      .sort()
      .map((key) => `${key}${parameters[key] ?? ""}`)
      .join("");
  return createHmac("sha1", token)
    .update(signedData)
    .digest("base64");
};

test("validates Twilio signatures and records delivered SMS callbacks", async (t) => {
  withEnvironment(t, {
    TWILIO_AUTH_TOKEN: "twilio-test-token",
    PUBLIC_API_URL: "https://api.example.test",
  });
  const originalUrl = "/api/v1/notification-delivery-webhooks/twilio";
  const parameters = {
    MessageSid: "SM123",
    MessageStatus: "delivered",
  };
  const signature = signTwilioRequest(
    process.env.TWILIO_AUTH_TOKEN,
    `${process.env.PUBLIC_API_URL}${originalUrl}`,
    parameters
  );

  let updateFilter;
  let updateData;
  t.mock.method(NotificationLog, "updateOne", async (filter, update) => {
    updateFilter = filter;
    updateData = update.$set;
    return { modifiedCount: 1 };
  });
  const result = await processTwilioNotificationWebhook({
    signature,
    originalUrl,
    parameters,
  });

  assert.deepEqual(result, { type: "sms_delivery", updated: true });
  assert.equal(updateFilter.channel, "sms");
  assert.equal(updateFilter.providerMessageId, "SM123");
  assert.deepEqual(updateData.status, "delivered");
  assert.ok(updateData.deliveredAt instanceof Date);
});

test("rejects invalid Twilio signatures before processing opt-outs", async (t) => {
  withEnvironment(t, {
    TWILIO_AUTH_TOKEN: "twilio-test-token",
    PUBLIC_API_URL: "https://api.example.test",
  });
  t.mock.method(User, "findOne", () => {
    assert.fail("Invalidly signed webhook must not query customers");
  });

  await assert.rejects(
    processTwilioNotificationWebhook({
      signature: "invalid",
      originalUrl: "/api/v1/notification-delivery-webhooks/twilio",
      parameters: { OptOutType: "STOP", From: "+14155550123" },
    }),
    { statusCode: 401 }
  );
});

test("applies signed Twilio STOP requests to channel consent", async (t) => {
  withEnvironment(t, {
    TWILIO_AUTH_TOKEN: "twilio-test-token",
    PUBLIC_API_URL: "https://api.example.test",
  });
  const originalUrl = "/api/v1/notification-delivery-webhooks/twilio";
  const parameters = {
    OptOutType: "STOP",
    From: "+14155550123",
  };
  const signature = signTwilioRequest(
    process.env.TWILIO_AUTH_TOKEN,
    `${process.env.PUBLIC_API_URL}${originalUrl}`,
    parameters
  );
  t.mock.method(User, "findOne", () => ({
    select() {
      return this;
    },
    lean: async () => ({ _id: USER_ID }),
  }));
  t.mock.method(
    NotificationPreference,
    "findOneAndUpdate",
    async (filter, update, options) => {
      assert.deepEqual(filter, { user: USER_ID });
      assert.equal(update.$set.smsNotifications, false);
      assert.equal(update.$set.promotionalSms, false);
      assert.equal(options.upsert, true);
      return {};
    }
  );

  assert.deepEqual(
    await processTwilioNotificationWebhook({
      signature,
      originalUrl,
      parameters,
    }),
    { type: "sms_opt_out", updated: true }
  );
});

test("validates Meta webhook signatures, status callbacks, and verification tokens", async (t) => {
  withEnvironment(t, {
    META_APP_SECRET: "meta-test-secret",
    WHATSAPP_WEBHOOK_VERIFY_TOKEN: "verify-me",
  });
  const rawBody = Buffer.from(
    JSON.stringify({
      entry: [
        {
          changes: [
            {
              value: {
                statuses: [
                  { id: "wamid.123", status: "read" },
                  { id: "wamid.456", status: "failed", errors: [{ code: 131000 }] },
                ],
              },
            },
          ],
        },
      ],
    })
  );
  const signature = `sha256=${createHmac(
    "sha256",
    process.env.META_APP_SECRET
  )
    .update(rawBody)
    .digest("hex")}`;
  assert.equal(verifyMetaWebhookSignature(rawBody, signature), true);
  assert.equal(verifyMetaWebhookSignature(rawBody, "sha256=invalid"), false);
  assert.equal(verifyMetaWebhookToken("verify-me"), true);
  assert.equal(verifyMetaWebhookToken("wrong"), false);

  const updates = [];
  t.mock.method(NotificationLog, "updateOne", async (filter, update) => {
    updates.push({ filter, update: update.$set });
    return { modifiedCount: 1 };
  });
  const result = await processMetaNotificationWebhook({
    rawBody,
    signature,
  });
  assert.deepEqual(result, {
    optOutsUpdated: 0,
    statusUpdates: 2,
    messagesReceived: 0,
  });
  assert.equal(updates[0].filter.channel, "whatsapp");
  assert.equal(updates[0].update.status, "delivered");
  assert.equal(updates[1].update.status, "failed");
});

test("rejects invalid Meta webhook signatures", async () => {
  await assert.rejects(
    processMetaNotificationWebhook({
      rawBody: Buffer.from("{}"),
      signature: "sha256=invalid",
    }),
    { statusCode: 401 }
  );
});
