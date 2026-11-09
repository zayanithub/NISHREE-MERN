import test from "node:test";
import assert from "node:assert/strict";

import NotificationLog from "../models/NotificationLog.js";
import NotificationPreference from "../models/NotificationPreference.js";
import NotificationTemplate from "../models/NotificationTemplate.js";
import User from "../models/User.js";
import {
  enqueueCustomerDeliveries,
  listAdminNotificationDeliveries,
  notificationDeliveryInternals,
  processNotificationDelivery,
  retryNotificationDelivery,
  upsertAdminNotificationTemplate,
} from "../service/notificationDeliveryService.js";
import {
  notificationRetrySchema,
  notificationTemplateSchema,
} from "../validations/notificationValidation.js";

const USER_ID = "507f1f77bcf86cd799439011";
const ORDER_ID = "507f1f77bcf86cd799439012";
const DELIVERY_ID = "507f1f77bcf86cd799439013";

const withDatabaseReady = (t) => {
  const connections = [
    User.db,
    NotificationPreference.db,
    NotificationLog.db,
  ];
  const originalStates = connections.map((connection) => connection.readyState);
  for (const connection of connections) {
    connection.readyState = 1;
  }
  t.after(() => {
    connections.forEach((connection, index) => {
      connection.readyState = originalStates[index];
    });
  });
};

const leanQuery = (value) => ({
  select() {
    return this;
  },
  lean: async () => value,
});

test("queues only opted-in channels with channel-specific idempotency keys", async (t) => {
  withDatabaseReady(t);
  t.mock.method(User, "findById", () =>
    leanQuery({
      email: "customer@example.test",
      phone: "+14155550123",
    })
  );
  t.mock.method(NotificationPreference, "findOne", () =>
    leanQuery({
      emailNotifications: true,
      smsNotifications: true,
      whatsappNotifications: false,
    })
  );

  const writes = [];
  t.mock.method(NotificationLog, "findOneAndUpdate", async (filter, update) => {
    writes.push({ filter, update });
    return { _id: writes.length };
  });

  const result = await enqueueCustomerDeliveries({
    userId: USER_ID,
    eventType: "order",
    deliveryKey: "order.created:order-123",
    title: "Order placed",
    message: "Your order was received.",
    orderId: ORDER_ID,
  });

  assert.equal(result.length, 2);
  assert.deepEqual(
    writes.map((write) => write.filter.deliveryKey),
    ["order.created:order-123:email", "order.created:order-123:sms"]
  );
  assert.equal(writes[0].update.$setOnInsert.templateKey, "order_update");
  assert.equal(writes[0].update.$setOnInsert.recipient, "customer@example.test");
  assert.equal(writes[1].update.$setOnInsert.provider, "twilio");
});

test("promotional deliveries require explicit opt-in per channel", async (t) => {
  withDatabaseReady(t);
  t.mock.method(User, "findById", () =>
    leanQuery({ email: "customer@example.test", phone: "+14155550123" })
  );
  t.mock.method(NotificationPreference, "findOne", () =>
    leanQuery({
      emailNotifications: true,
      promotionalEmail: false,
      promotionalSms: true,
      promotionalWhatsapp: false,
    })
  );
  const writes = [];
  t.mock.method(NotificationLog, "findOneAndUpdate", async (filter, update) => {
    writes.push({ filter, update });
    return { _id: writes.length };
  });

  await enqueueCustomerDeliveries({
    userId: USER_ID,
    eventType: "promotion",
    deliveryKey: "promotion.summer",
    title: "Sale",
    message: "New collection offers.",
    promotional: true,
  });

  assert.equal(writes.length, 1);
  assert.equal(writes[0].update.$setOnInsert.channel, "sms");
});

test("rejects unsafe action paths and undeclared template placeholders", async () => {
  await assert.rejects(
    enqueueCustomerDeliveries({
      userId: USER_ID,
      eventType: "order",
      deliveryKey: "unsafe-action",
      title: "Order placed",
      message: "Order received.",
      actionUrl: "//attacker.example",
    }),
    { code: "UNSAFE_ACTION_URL" }
  );
  await assert.rejects(
    upsertAdminNotificationTemplate(
      USER_ID,
      "order_update",
      "email",
      {
        name: "Order update",
        body: "Hello {{notDeclared}}",
        variables: ["message"],
      }
    ),
    { statusCode: 400 }
  );
  await assert.rejects(
    upsertAdminNotificationTemplate(USER_ID, "order_update", "email", {
      name: "Order update",
      body: "Hello",
      variables: ["customerName"],
    }),
    { statusCode: 400 }
  );
});

test("retries transient provider failures with bounded backoff", async (t) => {
  const env = {
    TWILIO_ACCOUNT_SID: process.env.TWILIO_ACCOUNT_SID,
    TWILIO_AUTH_TOKEN: process.env.TWILIO_AUTH_TOKEN,
    TWILIO_FROM_NUMBER: process.env.TWILIO_FROM_NUMBER,
  };
  t.after(() => {
    for (const [key, value] of Object.entries(env)) {
      if (value === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = value;
      }
    }
  });
  process.env.TWILIO_ACCOUNT_SID = "ACtest";
  process.env.TWILIO_AUTH_TOKEN = "test-token";
  process.env.TWILIO_FROM_NUMBER = "+14155550000";

  t.mock.method(globalThis, "fetch", async () => ({
    ok: false,
    status: 429,
    text: async () => JSON.stringify({ message: "Rate limited" }),
  }));
  t.mock.method(User, "findById", () =>
    leanQuery({ phone: "+14155550123" })
  );
  t.mock.method(NotificationPreference, "findOne", () =>
    leanQuery({ smsNotifications: true })
  );

  let savedUpdate;
  t.mock.method(NotificationLog, "findOneAndUpdate", async () => ({
    _id: DELIVERY_ID,
    channel: "sms",
    recipient: "+14155550123",
    templateKey: "order_update",
    attempts: 1,
    metadata: {
      templateVariables: {
        title: "Order placed",
        message: "Order received.",
        actionUrl: null,
      },
    },
  }));
  t.mock.method(NotificationTemplate, "findOne", () =>
    leanQuery(null)
  );
  t.mock.method(NotificationLog, "updateOne", async (filter, update) => {
    assert.deepEqual(filter, {
      _id: DELIVERY_ID,
      status: "sending",
    });
    savedUpdate = update.$set;
    return { modifiedCount: 1 };
  });

  const result = await processNotificationDelivery(DELIVERY_ID);
  assert.deepEqual(result, {
    id: DELIVERY_ID,
    status: "queued",
  });
  assert.equal(savedUpdate.lastErrorCode, "TWILIO_HTTP_429");
  assert.ok(savedUpdate.nextAttemptAt instanceof Date);
  assert.ok(savedUpdate.nextAttemptAt.getTime() > Date.now());
  assert.equal(
    notificationDeliveryInternals.nextAttemptAt(10).getTime() -
      Date.now() <=
      60 * 60 * 1000,
    true
  );
});

test("does not automatically retry when the email provider outcome is unknown", () => {
  const failure = notificationDeliveryInternals.getFailureState(
    {
      code: "RESEND_OUTCOME_UNKNOWN",
      outcomeUnknown: true,
    },
    1
  );
  assert.deepEqual(failure, {
    outcomeUnknown: true,
    status: "uncertain",
    lastErrorCode: "RESEND_OUTCOME_UNKNOWN",
    nextAttemptAt: null,
  });
});

test("does not retry permanent provider configuration errors", async (t) => {
  const previousSid = process.env.TWILIO_ACCOUNT_SID;
  const previousToken = process.env.TWILIO_AUTH_TOKEN;
  const previousFrom = process.env.TWILIO_FROM_NUMBER;
  delete process.env.TWILIO_ACCOUNT_SID;
  delete process.env.TWILIO_AUTH_TOKEN;
  delete process.env.TWILIO_FROM_NUMBER;
  t.after(() => {
    if (previousSid === undefined) delete process.env.TWILIO_ACCOUNT_SID;
    else process.env.TWILIO_ACCOUNT_SID = previousSid;
    if (previousToken === undefined) delete process.env.TWILIO_AUTH_TOKEN;
    else process.env.TWILIO_AUTH_TOKEN = previousToken;
    if (previousFrom === undefined) delete process.env.TWILIO_FROM_NUMBER;
    else process.env.TWILIO_FROM_NUMBER = previousFrom;
  });

  t.mock.method(User, "findById", () =>
    leanQuery({ phone: "+14155550123" })
  );
  t.mock.method(NotificationPreference, "findOne", () =>
    leanQuery({ smsNotifications: true })
  );
  let savedUpdate;
  t.mock.method(NotificationLog, "findOneAndUpdate", async () => ({
    _id: DELIVERY_ID,
    channel: "sms",
    recipient: "+14155550123",
    templateKey: "order_update",
    attempts: 1,
    metadata: {
      templateVariables: {
        title: "Order placed",
        message: "Order received.",
        actionUrl: null,
      },
    },
  }));
  t.mock.method(NotificationTemplate, "findOne", () =>
    leanQuery(null)
  );
  t.mock.method(NotificationLog, "updateOne", async (_filter, update) => {
    savedUpdate = update.$set;
    return { modifiedCount: 1 };
  });

  const result = await processNotificationDelivery(DELIVERY_ID);
  assert.deepEqual(result, {
    id: DELIVERY_ID,
    status: "failed",
  });
  assert.equal(savedUpdate.lastErrorCode, "TWILIO_CONFIG_MISSING");
  assert.equal(savedUpdate.nextAttemptAt, null);
});

test("suppresses queued messages when consent is withdrawn or contact changes", async (t) => {
  t.mock.method(User, "findById", () =>
    leanQuery({ phone: "+14155550123" })
  );
  t.mock.method(NotificationPreference, "findOne", () =>
    leanQuery({ smsNotifications: false })
  );
  t.mock.method(NotificationLog, "findOneAndUpdate", async () => ({
    _id: DELIVERY_ID,
    channel: "sms",
    recipient: "+14155550123",
    attempts: 1,
    metadata: { promotional: false },
  }));
  let savedUpdate;
  t.mock.method(NotificationLog, "updateOne", async (_filter, update) => {
    savedUpdate = update.$set;
    return { modifiedCount: 1 };
  });
  t.mock.method(globalThis, "fetch", () => {
    assert.fail("A delivery with revoked consent must not contact a provider");
  });

  const result = await processNotificationDelivery(DELIVERY_ID);
  assert.deepEqual(result, {
    id: DELIVERY_ID,
    status: "suppressed",
  });
  assert.equal(savedUpdate.status, "suppressed");
  assert.equal(savedUpdate.lastErrorCode, "DELIVERY_SUPPRESSED");
});

test("supports bounded admin delivery-log filters and failed-delivery retry", async (t) => {
  assert.deepEqual(notificationRetrySchema.safeParse({}).data, {
    confirmUnknownOutcome: false,
  });
  await assert.rejects(
    listAdminNotificationDeliveries({ channel: "carrier-pigeon" }),
    { statusCode: 400 }
  );
  await assert.rejects(
    listAdminNotificationDeliveries({ limit: "101" }),
    { statusCode: 400 }
  );

  t.mock.method(NotificationLog, "findById", () => ({
    lean: async () => ({
      _id: DELIVERY_ID,
      status: "failed",
    }),
  }));
  t.mock.method(NotificationLog, "findOneAndUpdate", async (filter, update) => {
    assert.deepEqual(filter, {
      _id: DELIVERY_ID,
      status: "failed",
    });
    assert.equal(update.$set.status, "queued");
    assert.equal(update.$set.attempts, 0);
    return { _id: DELIVERY_ID, status: "queued" };
  });
  const delivery = await retryNotificationDelivery(
    DELIVERY_ID,
    USER_ID
  );
  assert.equal(delivery.status, "queued");
});

test("requires explicit duplicate-risk confirmation before retrying uncertain sends", async (t) => {
  t.mock.method(NotificationLog, "findById", () => ({
    lean: async () => ({
      _id: DELIVERY_ID,
      status: "uncertain",
    }),
  }));
  t.mock.method(NotificationLog, "findOneAndUpdate", async (_filter, update) => {
    assert.equal(update.$set.status, "queued");
    assert.equal(
      update.$set["metadata.uncertainRetryConfirmedBy"],
      USER_ID
    );
    return { _id: DELIVERY_ID, status: "queued" };
  });

  await assert.rejects(
    retryNotificationDelivery(DELIVERY_ID, USER_ID),
    { statusCode: 409 }
  );
  const delivery = await retryNotificationDelivery(
    DELIVERY_ID,
    USER_ID,
    true
  );
  assert.equal(delivery.status, "queued");
});

test("renders only template-declared variables", () => {
  assert.equal(
    notificationDeliveryInternals.renderTemplateText(
      {
        body: "Hello {{name}}",
        variables: ["name"],
      },
      { name: "Nishree" }
    ),
    "Hello Nishree"
  );
  assert.throws(
    () =>
      notificationDeliveryInternals.renderTemplateText(
        {
          body: "{{accountNumber}}",
          variables: [],
        },
        { accountNumber: "secret" }
      ),
    /not available/
  );
});

test("sends WhatsApp approved-template requests with provider IDs", async (t) => {
  const env = {
    WHATSAPP_ACCESS_TOKEN: process.env.WHATSAPP_ACCESS_TOKEN,
    WHATSAPP_PHONE_NUMBER_ID: process.env.WHATSAPP_PHONE_NUMBER_ID,
    WHATSAPP_GRAPH_VERSION: process.env.WHATSAPP_GRAPH_VERSION,
    WHATSAPP_TEMPLATE_ORDER_UPDATE:
      process.env.WHATSAPP_TEMPLATE_ORDER_UPDATE,
  };
  t.after(() => {
    for (const [key, value] of Object.entries(env)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  });
  process.env.WHATSAPP_ACCESS_TOKEN = "test-access-token";
  process.env.WHATSAPP_PHONE_NUMBER_ID = "12345";
  process.env.WHATSAPP_GRAPH_VERSION = "v25.0";
  process.env.WHATSAPP_TEMPLATE_ORDER_UPDATE = "order_status_approved";
  t.mock.method(NotificationTemplate, "findOne", () =>
    leanQuery(null)
  );

  let request;
  t.mock.method(globalThis, "fetch", async (url, options) => {
    request = { url, options };
    return {
      ok: true,
      status: 200,
      text: async () =>
        JSON.stringify({ messages: [{ id: "wamid.test-1" }] }),
    };
  });

  const result = await notificationDeliveryInternals.sendDelivery({
    _id: DELIVERY_ID,
    channel: "whatsapp",
    recipient: "+14155550123",
    templateKey: "order_update",
    metadata: {
      templateVariables: {
        title: "Order placed",
        message: "Order received.",
        actionUrl: null,
      },
    },
  });

  assert.deepEqual(result, {
    provider: "meta_whatsapp",
    providerMessageId: "wamid.test-1",
  });
  assert.match(request.url, /graph\.facebook\.com/);
  assert.equal(
    request.options.headers.Authorization,
    "Bearer test-access-token"
  );
  assert.match(request.url, /graph\.facebook\.com\/v25\.0\//);
  const payload = JSON.parse(request.options.body);
  assert.equal(payload.to, "+14155550123");
  assert.equal(payload.template.name, "order_status_approved");
  assert.equal(
    payload.template.components[0].parameters[0].text,
    "Order placed: Order received."
  );
});

test("sends escaped transactional HTML through the Resend API", async (t) => {
  const keys = [
    "RESEND_API_KEY",
    "EMAIL_FROM",
    "FRONTEND_URL",
  ];
  const prior = Object.fromEntries(
    keys.map((key) => [key, process.env[key]])
  );
  Object.assign(process.env, {
    RESEND_API_KEY: "re_notification_test",
    EMAIL_FROM: "onboarding@resend.dev",
    FRONTEND_URL: "https://store.example.test",
  });
  t.after(() => {
    for (const [key, value] of Object.entries(prior)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  });
  let sentMessage;
  let requestOptions;
  t.mock.method(globalThis, "fetch", async (_url, options) => {
    requestOptions = options;
    sentMessage = JSON.parse(options.body);
    return new Response(JSON.stringify({ id: "resend-message-1" }), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  });
  t.mock.method(console, "info", () => {});
  t.mock.method(NotificationTemplate, "findOne", () =>
    leanQuery(null)
  );

  const result = await notificationDeliveryInternals.sendDelivery({
    _id: DELIVERY_ID,
    channel: "email",
    recipient: "customer@example.test",
    templateKey: "order_update",
    metadata: {
      templateVariables: {
        title: "<Order>",
        message: "Hello <script>alert(1)</script>",
        actionUrl: "/orders/123",
      },
    },
  });

  assert.deepEqual(result, {
    provider: "resend",
    providerMessageId: "resend-message-1",
  });
  assert.equal(sentMessage.to, "customer@example.test");
  assert.equal(
    requestOptions.headers.get("idempotency-key"),
    `notification-${DELIVERY_ID}`
  );
  assert.match(sentMessage.html, /&lt;script&gt;/);
  assert.doesNotMatch(sentMessage.html, /<script>/);
  assert.match(sentMessage.html, /https:\/\/store\.example\.test\/orders\/123/);
});

test("validates administrator-managed templates and renders stored templates", async (t) => {
  assert.equal(
    notificationTemplateSchema.safeParse({
      name: "Order update",
      body: "Hello {{title}}",
      variables: ["title"],
      extra: "not allowed",
    }).success,
    false
  );

  t.mock.method(
    NotificationTemplate,
    "findOneAndUpdate",
    async (filter, update, options) => {
      assert.deepEqual(filter, {
        key: "order_update",
        channel: "email",
      });
      assert.equal(update.$set.updatedBy, USER_ID);
      assert.equal(update.$set.body, "Hello {{title}}");
      assert.equal(options.upsert, true);
      return { key: filter.key, channel: filter.channel };
    }
  );

  await upsertAdminNotificationTemplate(
    USER_ID,
    "order_update",
    "email",
    {
      name: "Order update",
      subject: "Order details",
      body: "Hello {{title}}",
      variables: ["title"],
    }
  );
  await assert.rejects(
    upsertAdminNotificationTemplate(
      USER_ID,
      "order_update",
      "email",
      {
        name: "Order update",
        body: "Hi",
        variables: ["message", "message"],
      }
    ),
    { statusCode: 400 }
  );
});
