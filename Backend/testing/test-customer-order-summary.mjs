import test from "node:test";
import assert from "node:assert/strict";

import Order from "../models/Order.js";
import { getCustomerOrderSummary } from "../service/orderService.js";

const USER_ID = "507f1f77bcf86cd799439011";

test("customer order summary counts all orders, active orders, and delivered orders", async (t) => {
  const filters = [];
  t.mock.method(Order, "countDocuments", async (filter) => {
    filters.push(filter);
    if (filter.orderStatus === "delivered") return 3;
    if (filter.orderStatus?.$in) return 2;
    return 8;
  });

  assert.deepEqual(await getCustomerOrderSummary(USER_ID), {
    total: 8,
    active: 2,
    delivered: 3,
  });
  assert.equal(filters.length, 3);
  assert.ok(filters.every((filter) => String(filter.user) === USER_ID));
});

test("customer order summary rejects invalid customer IDs before querying", async (t) => {
  t.mock.method(Order, "countDocuments", () => {
    assert.fail("Invalid IDs must not reach the database.");
  });

  await assert.rejects(getCustomerOrderSummary("not-an-id"), {
    statusCode: 400,
    message: "Invalid customer ID.",
  });
});
