import test from "node:test";
import assert from "node:assert/strict";

import Order from "../models/Order.js";
import Shipping from "../models/Shipping.js";
import {
  createShipment,
  getCustomerShipmentByOrderId,
  listEligibleOrdersForShipping,
  updateShipmentStatus,
} from "../service/shippingService.js";

const ADMIN_ID = "507f1f77bcf86cd799439010";
const ORDER_ID = "507f1f77bcf86cd799439011";
const SHIPMENT_ID = "507f1f77bcf86cd799439012";
const shippingAddress = {
  fullName: "Nishree Customer",
  phone: "9876543210",
  addressLine1: "12 Silk Street",
  addressLine2: "",
  landmark: "",
  city: "Chennai",
  state: "Tamil Nadu",
  postalCode: "600001",
  country: "India",
};

const lean = (value) => ({ lean: async () => value });
const shipmentRecord = (overrides = {}) => ({
  _id: SHIPMENT_ID,
  order: ORDER_ID,
  status: "pending",
  failureReason: null,
  deliveryAttempts: 0,
  ...overrides,
});
const savedShipment = (value) => ({ toObject: () => value });

test("shipment creation snapshots the processing order address", async (t) => {
  const order = {
    _id: ORDER_ID,
    orderStatus: "processing",
    paymentMethod: "cod",
    paymentStatus: "pending",
    shippingAddress,
    shippingAmount: 75,
  };
  const createdShipment = { _id: SHIPMENT_ID, order: ORDER_ID, status: "pending" };
  t.mock.method(Order, "findById", () => lean(order));
  t.mock.method(Shipping, "exists", async () => null);
  const create = t.mock.method(Shipping, "create", async (data) => {
    assert.equal(data.order, ORDER_ID);
    assert.deepEqual(data.shippingAddress, shippingAddress);
    assert.equal(data.shippingCost, 75);
    assert.equal(data.createdBy, ADMIN_ID);
    return savedShipment(createdShipment);
  });

  assert.deepEqual(await createShipment(ADMIN_ID, ORDER_ID), createdShipment);
  assert.equal(create.mock.callCount(), 1);
});

test("shipment creation advances confirmed orders through processing first", async (t) => {
  const order = {
    _id: ORDER_ID,
    orderStatus: "confirmed",
    paymentMethod: "cod",
    paymentStatus: "pending",
    shippingAddress,
    shippingAmount: 75,
  };
  const orderQuery = { ...order, lean: async () => order };
  let transition;
  t.mock.method(Order, "findById", () => orderQuery);
  t.mock.method(Shipping, "exists", async () => null);
  t.mock.method(Order, "findOneAndUpdate", async (filter, update) => {
    transition = { filter, update };
    return null;
  });
  const create = t.mock.method(Shipping, "create", async () => {
    assert.fail("A shipment must not be created before the order enters processing.");
  });

  await assert.rejects(
    createShipment(ADMIN_ID, ORDER_ID),
    {
      statusCode: 409,
      message: "The order was updated by another request. Please refresh and retry.",
    },
  );
  assert.deepEqual(transition.filter, { _id: ORDER_ID, orderStatus: "confirmed" });
  assert.equal(transition.update.$set.orderStatus, "processing");
  assert.equal(create.mock.callCount(), 0);
});

test("shipment candidates include confirmed and processing orders without existing shipments", async (t) => {
  const shipmentOrderIds = [ORDER_ID];
  const eligibleOrders = [
    { _id: "507f1f77bcf86cd799439013", orderNumber: "NIS-1000", orderStatus: "confirmed" },
    { _id: "507f1f77bcf86cd799439014", orderNumber: "NIS-1001", orderStatus: "processing" },
  ];
  let orderFilter;
  let sortOptions;
  let skipAmount;
  let limitAmount;
  t.mock.method(Shipping, "distinct", async (field) => {
    assert.equal(field, "order");
    return shipmentOrderIds;
  });
  t.mock.method(Order, "find", (filter) => {
    orderFilter = filter;
    return {
      sort(options) {
        sortOptions = options;
        return this;
      },
      skip(amount) {
        skipAmount = amount;
        return this;
      },
      limit(amount) {
        limitAmount = amount;
        return this;
      },
      lean: async () => eligibleOrders,
    };
  });
  t.mock.method(Order, "countDocuments", async () => eligibleOrders.length);

  const result = await listEligibleOrdersForShipping({ page: 2, limit: 10 });
  assert.deepEqual(result, {
    orders: eligibleOrders,
    pagination: { page: 2, limit: 10, total: 2, totalPages: 1 },
  });
  assert.deepEqual(orderFilter, {
    orderStatus: { $in: ["confirmed", "processing"] },
    shippingAddress: { $exists: true, $ne: null },
    _id: { $nin: shipmentOrderIds },
    $or: [
      { paymentMethod: "razorpay", paymentStatus: "paid" },
      { paymentMethod: "cod", paymentStatus: { $in: ["pending", "paid"] } },
    ],
  });
  assert.deepEqual(sortOptions, { createdAt: -1, _id: -1 });
  assert.equal(skipAmount, 10);
  assert.equal(limitAmount, 10);
});

test("marking a shipment shipped synchronizes a processing order", async (t) => {
  const shipment = shipmentRecord({ status: "ready_to_ship" });
  const order = { _id: ORDER_ID, orderStatus: "processing", orderNumber: "NIS-1001" };
  let orderUpdate;
  let shipmentUpdate;
  t.mock.method(Shipping, "findById", () => lean(shipment));
  t.mock.method(Order, "findById", () => lean(order));
  t.mock.method(Order, "findOneAndUpdate", async (filter, update) => {
    assert.deepEqual(filter, { _id: ORDER_ID, orderStatus: "processing" });
    orderUpdate = update;
    return { ...order, orderStatus: "shipped" };
  });
  t.mock.method(Shipping, "findOneAndUpdate", async (_filter, update) => {
    shipmentUpdate = update;
    return savedShipment({ ...shipment, ...update.$set });
  });

  const result = await updateShipmentStatus(SHIPMENT_ID, "shipped");
  assert.equal(orderUpdate.$set.orderStatus, "shipped");
  assert.ok(orderUpdate.$set.shippedAt instanceof Date);
  assert.equal(shipmentUpdate.$set.status, "shipped");
  assert.ok(shipmentUpdate.$set.shippedAt instanceof Date);
  assert.equal(result.status, "shipped");
});

test("marking an out-for-delivery shipment delivered synchronizes its order", async (t) => {
  const shipment = shipmentRecord({ status: "out_for_delivery", deliveryAttempts: 1 });
  const order = { _id: ORDER_ID, orderStatus: "shipped", orderNumber: "NIS-1002" };
  let orderUpdate;
  let shipmentUpdate;
  t.mock.method(Shipping, "findById", () => lean(shipment));
  t.mock.method(Order, "findById", () => lean(order));
  t.mock.method(Order, "findOneAndUpdate", async (_filter, update) => {
    orderUpdate = update;
    return { ...order, orderStatus: "delivered" };
  });
  t.mock.method(Shipping, "findOneAndUpdate", async (_filter, update) => {
    shipmentUpdate = update;
    return savedShipment({ ...shipment, ...update.$set });
  });

  const result = await updateShipmentStatus(SHIPMENT_ID, "delivered");
  assert.equal(orderUpdate.$set.orderStatus, "delivered");
  assert.ok(orderUpdate.$set.deliveredAt instanceof Date);
  assert.equal(shipmentUpdate.$set.status, "delivered");
  assert.ok(shipmentUpdate.$set.deliveredAt instanceof Date);
  assert.equal(result.status, "delivered");
});

test("shipment failure needs a reason and retry clears the previous failure", async (t) => {
  const failedShipment = shipmentRecord({
    status: "delivery_failed",
    failureReason: "Customer was unavailable",
  });
  const order = { _id: ORDER_ID, orderStatus: "shipped", orderNumber: "NIS-1003" };
  t.mock.method(Shipping, "findById", () => lean(failedShipment));
  t.mock.method(Order, "findById", () => lean(order));
  let shipmentUpdate;
  t.mock.method(Shipping, "findOneAndUpdate", async (_filter, update) => {
    shipmentUpdate = update;
    return savedShipment({ ...failedShipment, ...update.$set });
  });

  await assert.rejects(
    updateShipmentStatus(SHIPMENT_ID, "in_transit", { failureReason: "Not allowed here" }),
    { statusCode: 400 },
  );
  const result = await updateShipmentStatus(SHIPMENT_ID, "in_transit");
  assert.equal(result.status, "in_transit");
  assert.equal(shipmentUpdate.$set.failureReason, null);
});

test("shipment cannot skip required delivery states", async (t) => {
  const shipment = shipmentRecord({ status: "pending" });
  t.mock.method(Shipping, "findById", () => lean(shipment));

  await assert.rejects(updateShipmentStatus(SHIPMENT_ID, "delivered"), {
    statusCode: 409,
    message: 'Shipment cannot transition from "pending" to "delivered".',
  });
});

test("a cancelled pre-shipment can be reopened with stale tracking data cleared", async (t) => {
  const shipment = shipmentRecord({
    status: "cancelled",
    carrier: "Old Courier",
    trackingNumber: "OLD-TRACK",
    trackingUrl: "https://carrier.example/old",
    estimatedDeliveryAt: new Date("2026-11-10T00:00:00.000Z"),
    deliveryAttempts: 1,
    deliveryNotes: "Old shipment note",
  });
  const order = { _id: ORDER_ID, orderStatus: "processing", orderNumber: "NIS-1005" };
  let shipmentOperations;
  t.mock.method(Shipping, "findById", () => lean(shipment));
  t.mock.method(Order, "findById", () => lean(order));
  t.mock.method(Shipping, "findOneAndUpdate", async (_filter, update) => {
    shipmentOperations = update;
    return savedShipment({ ...shipment, ...update.$set, trackingNumber: undefined });
  });

  const result = await updateShipmentStatus(SHIPMENT_ID, "pending");
  assert.equal(result.status, "pending");
  assert.equal(result.trackingNumber, undefined);
  assert.deepEqual(shipmentOperations.$unset, { trackingNumber: 1 });
  assert.equal(shipmentOperations.$set.carrier, null);
  assert.equal(shipmentOperations.$set.trackingUrl, null);
  assert.equal(shipmentOperations.$set.deliveryAttempts, 0);
  assert.equal(shipmentOperations.$set.deliveryNotes, "");
  assert.equal(order.orderStatus, "processing");
});

test("failed shipment persistence rolls back the synchronized order", async (t) => {
  const shipment = shipmentRecord({ status: "ready_to_ship" });
  const order = { _id: ORDER_ID, orderStatus: "processing" };
  let orderUpdate;
  let rollback;
  t.mock.method(Shipping, "findById", () => lean(shipment));
  t.mock.method(Order, "findById", () => lean(order));
  t.mock.method(Order, "findOneAndUpdate", async (_filter, update) => {
    orderUpdate = update;
    return { ...order, orderStatus: "shipped" };
  });
  t.mock.method(Shipping, "findOneAndUpdate", async () => null);
  t.mock.method(Order, "updateOne", async (filter, update) => {
    rollback = { filter, update };
    return { modifiedCount: 1 };
  });

  await assert.rejects(updateShipmentStatus(SHIPMENT_ID, "shipped"), {
    statusCode: 409,
    message: "The shipment was changed by another request. Refresh and retry.",
  });
  assert.equal(orderUpdate.$set.orderStatus, "shipped");
  assert.equal(rollback.filter.orderStatus, "shipped");
  assert.equal(rollback.update.$set.orderStatus, "processing");
});

test("customer shipment lookup scopes the order to the signed-in customer", async (t) => {
  const shipment = shipmentRecord({
    status: "in_transit",
    carrier: "Courier",
    trackingNumber: "TRACK-123",
    failureReason: null,
  });
  let orderFilter;
  let shipmentFilter;
  t.mock.method(Order, "findOne", (filter) => {
    orderFilter = filter;
    return {
      select: () => lean({ _id: ORDER_ID, orderNumber: "NIS-1004", orderStatus: "shipped" }),
    };
  });
  t.mock.method(Shipping, "findOne", (filter) => {
    shipmentFilter = filter;
    return lean(shipment);
  });

  const result = await getCustomerShipmentByOrderId(ADMIN_ID, ORDER_ID);
  assert.deepEqual(orderFilter, { _id: ORDER_ID, user: ADMIN_ID });
  assert.deepEqual(shipmentFilter, { order: ORDER_ID });
  assert.equal(result.shipment.trackingNumber, "TRACK-123");
  assert.equal(result.shipment.status, "in_transit");
});
