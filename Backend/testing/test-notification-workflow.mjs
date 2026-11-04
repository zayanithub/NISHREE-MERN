import test from "node:test";
import assert from "node:assert/strict";

import Notification from "../models/Notification.js";
import NotificationPreference from "../models/NotificationPreference.js";
import {
  createInAppNotification,
  clearNotifications,
  getUnreadNotificationCount,
  listNotifications,
  markAllNotificationsRead,
  markNotificationRead,
  updateNotificationPreferences,
} from "../service/notificationService.js";
import { notificationPreferenceSchema } from "../validations/notificationValidation.js";

const CUSTOMER_ID = "507f1f77bcf86cd799439011";
const ADMIN_ID = "507f1f77bcf86cd799439013";
const NOTIFICATION_ID = "507f1f77bcf86cd799439014";
const ORDER_ID = "507f1f77bcf86cd799439015";

const withNotificationDatabase = (t) => {
  const readyState = Notification.db.readyState;
  Notification.db.readyState = 1;
  t.after(() => {
    Notification.db.readyState = readyState;
  });
};

const preferenceQuery = (value) => ({
  lean: async () => value,
});

const listQuery = (value) => ({
  sort() {
    return this;
  },
  skip() {
    return this;
  },
  limit() {
    return this;
  },
  lean: async () => value,
});

test("validates notification recipient, URL, type, and idempotency input", async () => {
  const validFields = {
    user: CUSTOMER_ID,
    type: "order",
    title: "Order placed",
    message: "Order received.",
  };

  await assert.rejects(
    new Notification({
      ...validFields,
      actionUrl: "https://attacker.example",
    }).validate(),
    /internal path/
  );

  await assert.rejects(
    new Notification({
      ...validFields,
      adminUser: ADMIN_ID,
    }).validate(),
    /exactly one customer or admin recipient/
  );

  assert.equal(
    notificationPreferenceSchema.safeParse({
      inAppNotifications: false,
      unexpected: true,
    }).success,
    false
  );
});

test("creates a notification idempotently within its recipient scope", async (t) => {
  withNotificationDatabase(t);
  t.mock.method(NotificationPreference, "findOne", () =>
    preferenceQuery(null)
  );

  const existing = {
    _id: NOTIFICATION_ID,
    user: CUSTOMER_ID,
    type: "order",
    isRead: false,
  };
  t.mock.method(Notification, "findOneAndUpdate", async (filter, update) => {
    assert.deepEqual(filter, {
      idempotencyKey: "order.created:order-1",
      user: CUSTOMER_ID,
    });
    assert.equal(
      update.$setOnInsert.idempotencyKey,
      "order.created:order-1"
    );
    return existing;
  });

  const result = await createInAppNotification({
    recipientId: CUSTOMER_ID,
    type: "order",
    title: "Order placed",
    message: "Your order was received.",
    relatedOrder: ORDER_ID,
    actionUrl: `/orders/${ORDER_ID}`,
    idempotencyKey: "order.created:order-1",
  });

  assert.equal(result, existing);
});

test("does not persist notifications opted out by category or globally", async (t) => {
  withNotificationDatabase(t);
  t.mock.method(NotificationPreference, "findOne", () =>
    preferenceQuery({ inAppNotifications: true, shippingUpdates: false })
  );
  t.mock.method(Notification, "findOneAndUpdate", () => {
    assert.fail("Opted-out notifications must not be inserted");
  });

  const result = await createInAppNotification({
    recipientId: CUSTOMER_ID,
    type: "shipping",
    title: "Shipped",
    message: "Package shipped.",
    idempotencyKey: "shipping.status:shipment-1:shipped",
  });
  assert.equal(result, null);
});

test("scopes notification list and unread count to the authenticated recipient", async (t) => {
  const expected = [{ _id: NOTIFICATION_ID, user: CUSTOMER_ID }];
  t.mock.method(Notification, "find", (filter) => {
    assert.deepEqual(filter, {
      user: CUSTOMER_ID,
      type: "order",
      isRead: false,
    });
    return listQuery(expected);
  });
  t.mock.method(Notification, "countDocuments", async (filter) => {
    if (filter.user) {
      assert.deepEqual(filter, {
        user: CUSTOMER_ID,
        type: "order",
        isRead: false,
      });
      return 1;
    }
    assert.deepEqual(filter, {
      adminUser: ADMIN_ID,
      isRead: false,
    });
    return 3;
  });

  const result = await listNotifications("user", CUSTOMER_ID, {
    type: "order",
    isRead: "false",
    page: "2",
    limit: "10",
  });
  assert.equal(result.notifications, expected);
  assert.deepEqual(result.pagination, {
    page: 2,
    limit: 10,
    total: 1,
    totalPages: 1,
  });

  assert.equal(
    await getUnreadNotificationCount("adminUser", ADMIN_ID),
    3
  );
});

test("prevents a customer from reading another recipient's notification", async (t) => {
  t.mock.method(Notification, "findOneAndUpdate", async (filter) => {
    assert.deepEqual(filter, {
      _id: NOTIFICATION_ID,
      user: CUSTOMER_ID,
      isRead: false,
    });
    return null;
  });
  t.mock.method(Notification, "findOne", (filter) => {
    assert.deepEqual(filter, {
      _id: NOTIFICATION_ID,
      user: CUSTOMER_ID,
    });
    return preferenceQuery(null);
  });

  await assert.rejects(
    markNotificationRead("user", CUSTOMER_ID, NOTIFICATION_ID),
    { statusCode: 404 }
  );
});

test("marks only the authenticated recipient's notifications as read", async (t) => {
  const now = new Date();
  t.mock.method(Notification, "updateMany", async (filter, update) => {
    assert.deepEqual(filter, {
      adminUser: ADMIN_ID,
      isRead: false,
    });
    assert.equal(update.$set.isRead, true);
    assert.ok(update.$set.readAt instanceof Date);
    assert.ok(update.$set.readAt >= now);
    return { modifiedCount: 2 };
  });

  assert.deepEqual(
    await markAllNotificationsRead("adminUser", ADMIN_ID),
    { modifiedCount: 2 }
  );
});

test("clears notifications only for the authenticated customer", async (t) => {
  t.mock.method(Notification, "deleteMany", async (filter) => {
    assert.deepEqual(filter, { user: CUSTOMER_ID });
    return { deletedCount: 4 };
  });

  assert.deepEqual(
    await clearNotifications("user", CUSTOMER_ID),
    { deletedCount: 4 }
  );
});

test("rejects malformed preference updates and persists supported booleans", async (t) => {
  await assert.rejects(
    updateNotificationPreferences(CUSTOMER_ID, {
      inAppNotifications: "false",
    }),
    { statusCode: 400 }
  );

  t.mock.method(
    NotificationPreference,
    "findOneAndUpdate",
    async (filter, update) => {
      assert.deepEqual(filter, { user: CUSTOMER_ID });
      assert.deepEqual(update, {
        $set: { inAppNotifications: false, refundUpdates: true },
        $setOnInsert: { user: CUSTOMER_ID },
      });
      return { user: CUSTOMER_ID, ...update.$set };
    }
  );

  const preferences = await updateNotificationPreferences(
    CUSTOMER_ID,
    { inAppNotifications: false, refundUpdates: true }
  );
  assert.equal(preferences.inAppNotifications, false);
  assert.equal(preferences.refundUpdates, true);
});

test("rejects notification IDs that collide across recipients", async (t) => {
  withNotificationDatabase(t);
  t.mock.method(NotificationPreference, "findOne", () =>
    preferenceQuery(null)
  );
  t.mock.method(Notification, "findOneAndUpdate", async () => {
    const error = new Error("duplicate key");
    error.code = 11000;
    throw error;
  });
  t.mock.method(Notification, "findOne", (filter) => {
    assert.deepEqual(filter, {
      idempotencyKey: "shared-key",
      user: CUSTOMER_ID,
    });
    return preferenceQuery(null);
  });

  await assert.rejects(
    createInAppNotification({
      recipientId: CUSTOMER_ID,
      type: "system",
      title: "System update",
      message: "Update available.",
      idempotencyKey: "shared-key",
    }),
    { statusCode: 409 }
  );
});
