import test from "node:test";
import assert from "node:assert/strict";

import Order from "../models/Order.js";
import { updateOrderStatus } from "../service/orderService.js";

const ORDER_ID = "507f1f77bcf86cd799439011";

test("order status changes cannot bypass shipment tracking", async (t) => {
  const order = {
    _id: ORDER_ID,
    orderStatus: "processing",
    paymentMethod: "cod",
    paymentStatus: "pending",
  };
  t.mock.method(Order, "findById", async () => order);
  t.mock.method(Order, "findOneAndUpdate", () => {
    assert.fail("Order must not be marked shipped outside the shipping workflow");
  });

  await assert.rejects(
    updateOrderStatus(ORDER_ID, "shipped"),
    {
      statusCode: 409,
      message:
        "Update delivery progress through the Shipping workflow so the tracking record and order status stay synchronized.",
    }
  );
});

test("repeating the current shipment-managed order status remains idempotent", async (t) => {
  const order = {
    _id: ORDER_ID,
    orderStatus: "shipped",
    paymentMethod: "cod",
    paymentStatus: "pending",
  };
  t.mock.method(Order, "findById", async () => order);

  assert.equal(await updateOrderStatus(ORDER_ID, "shipped"), order);
});
