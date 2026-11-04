import test from "node:test";
import assert from "node:assert/strict";

import mongoose from "mongoose";
import AuditLog from "../models/AuditLog.js";
import Notification from "../models/Notification.js";
import NotificationOutbox from "../models/NotificationOutbox.js";
import NotificationPreference from "../models/NotificationPreference.js";
import User from "../models/User.js";
import app from "../app.js";
import {
  emitCustomerNotification,
  processNotificationOutboxEvent,
  retryFailedNotificationOutboxEvent,
} from "../service/notificationService.js";
import { validateRuntimeConfig } from "../config/runtimeConfig.js";

const EVENT_ID = "507f1f77bcf86cd799439021";
const USER_ID = "507f1f77bcf86cd799439022";
const NOTIFICATION_ID = "507f1f77bcf86cd799439023";

test("runtime config validates ports and production security-critical settings", () => {
  assert.deepEqual(
    validateRuntimeConfig({ PORT: "5100", COOKIE_SAME_SITE: "strict" }),
    { port: 5100, sameSite: "strict" }
  );
  assert.throws(
    () => validateRuntimeConfig({ PORT: "70000" }),
    /PORT must be/
  );
  assert.throws(
    () =>
      validateRuntimeConfig({
        NODE_ENV: "production",
        PORT: "5000",
        MONGO_URL: "http://localhost:27017/store",
        JWT_ACCESS_SECRET: "short",
        FRONTEND_URL: "http://store.example",
      }),
    /valid MONGO_URL/
  );
  assert.throws(
    () =>
      validateRuntimeConfig({
        NODE_ENV: "production",
        PORT: "5000",
        MONGO_URL: "mongodb://localhost:27017/store",
        JWT_ACCESS_SECRET: "a".repeat(32),
        FRONTEND_URL: "not-a-url",
      }),
    /FRONTEND_URL must be a valid HTTPS URL/
  );
  assert.deepEqual(
    validateRuntimeConfig({
      NODE_ENV: "production",
      PORT: "5000",
      MONGO_URL: "mongodb://localhost:27017/store",
      JWT_ACCESS_SECRET: "a".repeat(32),
      FRONTEND_URL: "https://store.example",
      PUBLIC_API_URL: "https://api.store.example",
      SMTP_HOST: "smtp.example.test",
      SMTP_PORT: "465",
      SMTP_SECURE: "true",
      SMTP_USER: "sender@example.test",
      SMTP_PASS: "smtp-test-password",
    }),
    { port: 5000, sameSite: "lax" }
  );
  assert.throws(
    () =>
      validateRuntimeConfig({
        NODE_ENV: "production",
        PORT: "5000",
        MONGO_URL: "mongodb://localhost:27017/store",
        JWT_ACCESS_SECRET: "a".repeat(32),
        FRONTEND_URL: "https://store.example",
      }),
    /SMTP_HOST, SMTP_PORT, SMTP_USER, and SMTP_PASS/
  );
});

test("notification outbox requeues failed processing with a bounded retry", async (t) => {
  const connection = mongoose.connection;
  const readyState = connection.readyState;
  connection.readyState = 0;
  t.after(() => {
    connection.readyState = readyState;
  });

  const updates = [];
  t.mock.method(NotificationOutbox, "findOneAndUpdate", () => ({
    lean: async () => ({
      _id: EVENT_ID,
      user: USER_ID,
      attempts: 1,
      payload: {
        recipientType: "user",
        recipientId: USER_ID,
        type: "order",
        title: "Order update",
        message: "Order status changed.",
        idempotencyKey: "order.updated:order-1",
      },
    }),
  }));
  t.mock.method(NotificationOutbox, "updateOne", async (filter, update) => {
    updates.push({ filter, update });
    return { modifiedCount: 1 };
  });
  t.mock.method(console, "error", () => {});

  const result = await processNotificationOutboxEvent(EVENT_ID);
  assert.equal(result, null);
  assert.equal(updates.length, 1);
  assert.deepEqual(updates[0].filter, {
    _id: EVENT_ID,
    status: "processing",
  });
  assert.equal(updates[0].update.$set.status, "pending");
  assert.ok(updates[0].update.$set.nextAttemptAt instanceof Date);
  assert.equal(
    updates[0].update.$set.lastError,
    "Notification database is not connected."
  );
});

test("outbox persists events before processing and reuses idempotent results", async (t) => {
  const connection = mongoose.connection;
  const readyState = connection.readyState;
  connection.readyState = 1;
  t.after(() => {
    connection.readyState = readyState;
  });
  const event = {
    recipientId: USER_ID,
    type: "order",
    title: "Order update",
    message: "Order status changed.",
    idempotencyKey: "order.updated:order-1",
  };
  const notification = { _id: NOTIFICATION_ID, user: USER_ID };
  let insertCount = 0;
  let claimCount = 0;
  t.mock.method(NotificationOutbox, "findOneAndUpdate", (filter, update) => {
    if (update.$setOnInsert) {
      insertCount += 1;
      assert.deepEqual(filter, {
        user: USER_ID,
        eventKey: event.idempotencyKey,
      });
      return { _id: EVENT_ID };
    }
    claimCount += 1;
    if (claimCount === 1) {
      return {
        lean: async () => ({
          _id: EVENT_ID,
          attempts: 1,
          payload: {
            recipientType: "user",
            ...event,
            relatedOrder: null,
            relatedProduct: null,
            actionUrl: null,
          },
        }),
      };
    }
    return { lean: async () => null };
  });
  t.mock.method(NotificationOutbox, "findById", () => ({
    select() {
      return this;
    },
    lean: async () => ({ notification: NOTIFICATION_ID }),
  }));
  t.mock.method(NotificationOutbox, "updateOne", async () => ({
    modifiedCount: 1,
  }));
  t.mock.method(Notification, "findOneAndUpdate", async () => notification);
  t.mock.method(Notification, "findById", () => ({
    lean: async () => notification,
  }));
  t.mock.method(NotificationPreference, "findOne", () => ({
    lean: async () => null,
  }));
  t.mock.method(User, "findById", () => ({
    select() {
      return this;
    },
    lean: async () => ({ email: null, phone: null }),
  }));

  assert.equal(await emitCustomerNotification(event), notification);
  assert.equal(await emitCustomerNotification(event), notification);
  assert.equal(insertCount, 2);
  assert.equal(claimCount, 2);
});

test("manual outbox replay only resets a failed event and validates its identifier", async (t) => {
  const operations = [];
  t.mock.method(
    NotificationOutbox,
    "findOneAndUpdate",
    (filter, update) => {
      operations.push({ filter, update });
      if (operations.length === 1) {
        return { _id: EVENT_ID };
      }
      if (operations.length === 2) {
        const claimed = {
          _id: EVENT_ID,
          attempts: 1,
          payload: {
            recipientType: "user",
            recipientId: USER_ID,
            type: "order",
            title: "Order update",
            message: "Order status changed.",
            idempotencyKey: "order.updated:order-1",
          },
        };
        return { lean: async () => claimed };
      }
      return null;
    }
  );
  t.mock.method(NotificationOutbox, "findById", () => ({
    select() {
      return this;
    },
    lean: async () => ({
      _id: EVENT_ID,
      status: "pending",
      attempts: 1,
    }),
  }));
  t.mock.method(NotificationOutbox, "updateOne", async () => ({
    modifiedCount: 1,
  }));
  t.mock.method(console, "error", () => {});

  await assert.rejects(
    retryFailedNotificationOutboxEvent("invalid"),
    { statusCode: 400 }
  );
  const result = await retryFailedNotificationOutboxEvent(EVENT_ID);
  assert.equal(result.status, "pending");
  assert.deepEqual(operations[0].filter, {
    _id: EVENT_ID,
    status: "failed",
  });
  assert.equal(operations[0].update.$set.attempts, 0);
});

test("readiness endpoint reports database readiness and audit schemas have query indexes", async (t) => {
  const connection = mongoose.connection;
  const readyState = connection.readyState;
  connection.readyState = 0;
  const server = app.listen(0);
  t.after(async () => {
    await new Promise((resolve, reject) =>
      server.close((error) => (error ? reject(error) : resolve()))
    );
    connection.readyState = readyState;
  });
  const response = await fetch(
    `http://127.0.0.1:${server.address().port}/api/ready`
  );
  assert.equal(response.status, 503);
  const body = await response.json();
  assert.equal(body.database, "Disconnected");
  assert.ok(
    NotificationOutbox.schema.indexes().some(([keys]) =>
      keys.user === 1 && keys.eventKey === 1
    )
  );
  assert.ok(AuditLog.schema.indexes().some(([keys]) => keys.createdAt === -1));
});
