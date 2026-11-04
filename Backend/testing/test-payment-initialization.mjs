import test from "node:test";
import assert from "node:assert/strict";
import Razorpay from "razorpay";
import Order from "../models/Order.js";
import Payment from "../models/Payment.js";
import { createRazorpayPaymentOrder } from "../service/paymentService.js";

const USER_ID = "507f1f77bcf86cd799439011";
const ORDER_ID = "507f1f77bcf86cd799439012";

test("missing Razorpay configuration does not leave an un-retryable payment attempt", async (t) => {
  const previousKeyId = process.env.RAZORPAY_KEY_ID;
  const previousKeySecret = process.env.RAZORPAY_KEY_SECRET;
  delete process.env.RAZORPAY_KEY_ID;
  delete process.env.RAZORPAY_KEY_SECRET;
  t.after(() => {
    if (previousKeyId === undefined) delete process.env.RAZORPAY_KEY_ID;
    else process.env.RAZORPAY_KEY_ID = previousKeyId;
    if (previousKeySecret === undefined) {
      delete process.env.RAZORPAY_KEY_SECRET;
    } else {
      process.env.RAZORPAY_KEY_SECRET = previousKeySecret;
    }
  });

  const paymentCreates = [];
  t.mock.method(Payment, "findOne", (filter) => {
    if (filter.idempotencyKey) return null;
    return { sort: async () => null };
  });
  t.mock.method(Order, "findOne", async () => ({
    _id: ORDER_ID,
    orderNumber: "NIA-TEST",
    paymentMethod: "razorpay",
    orderStatus: "pending_payment",
    paymentStatus: "pending",
    totalAmount: 1250,
  }));
  t.mock.method(Payment, "create", async (data) => {
    paymentCreates.push(data);
  });

  await assert.rejects(
    createRazorpayPaymentOrder(USER_ID, ORDER_ID, "payment-test-key"),
    {
      statusCode: 503,
      message: "Razorpay configuration is missing.",
    }
  );
  assert.equal(paymentCreates.length, 0);
});

test("payment initialization creates a server-priced Razorpay checkout without exposing the secret", async (t) => {
  const previousKeyId = process.env.RAZORPAY_KEY_ID;
  const previousKeySecret = process.env.RAZORPAY_KEY_SECRET;
  process.env.RAZORPAY_KEY_ID = "rzp_test_public_key";
  process.env.RAZORPAY_KEY_SECRET = "test-only-secret";
  t.after(() => {
    if (previousKeyId === undefined) delete process.env.RAZORPAY_KEY_ID;
    else process.env.RAZORPAY_KEY_ID = previousKeyId;
    if (previousKeySecret === undefined) {
      delete process.env.RAZORPAY_KEY_SECRET;
    } else {
      process.env.RAZORPAY_KEY_SECRET = previousKeySecret;
    }
  });

  let gatewayOrderRequest;
  let savedPayment;
  t.mock.method(Razorpay.prototype, "addResources", function () {
    this.orders = {
      create: async (request) => {
        gatewayOrderRequest = request;
        return { id: "order_test_123", status: "created" };
      },
    };
  });
  t.mock.method(Payment, "findOne", (filter) => {
    if (filter.idempotencyKey) return null;
    return { sort: async () => null };
  });
  t.mock.method(Order, "findOne", async () => ({
    _id: ORDER_ID,
    orderNumber: "NIA-TEST",
    paymentMethod: "razorpay",
    orderStatus: "pending_payment",
    paymentStatus: "pending",
    totalAmount: 1250,
  }));
  t.mock.method(Payment, "create", async (data) => {
    savedPayment = {
      ...data,
      _id: "507f1f77bcf86cd799439013",
      save: async () => {},
    };
    return savedPayment;
  });

  const result = await createRazorpayPaymentOrder(
    USER_ID,
    ORDER_ID,
    "payment-test-success"
  );

  assert.equal(gatewayOrderRequest.amount, 125000);
  assert.equal(gatewayOrderRequest.currency, "INR");
  assert.equal(savedPayment.status, "pending");
  assert.equal(savedPayment.razorpayOrderId, "order_test_123");
  assert.deepEqual(result.checkout, {
    keyId: "rzp_test_public_key",
    orderId: "order_test_123",
    amount: 125000,
    currency: "INR",
  });
  assert.equal(JSON.stringify(result).includes("test-only-secret"), false);
});

test("Razorpay authentication errors are returned as gateway failures, not customer 401s", async (t) => {
  const previousKeyId = process.env.RAZORPAY_KEY_ID;
  const previousKeySecret = process.env.RAZORPAY_KEY_SECRET;
  process.env.RAZORPAY_KEY_ID = "rzp_test_public_key";
  process.env.RAZORPAY_KEY_SECRET = "test-only-secret";
  t.after(() => {
    if (previousKeyId === undefined) delete process.env.RAZORPAY_KEY_ID;
    else process.env.RAZORPAY_KEY_ID = previousKeyId;
    if (previousKeySecret === undefined) {
      delete process.env.RAZORPAY_KEY_SECRET;
    } else {
      process.env.RAZORPAY_KEY_SECRET = previousKeySecret;
    }
  });

  let savedPayment;
  t.mock.method(Razorpay.prototype, "addResources", function () {
    this.orders = {
      create: async () => {
        throw {
          statusCode: 401,
          error: {
            code: "BAD_REQUEST_ERROR",
            description: "Authentication failed",
          },
        };
      },
    };
  });
  t.mock.method(Payment, "findOne", (filter) => {
    if (filter.idempotencyKey) return null;
    return { sort: async () => null };
  });
  t.mock.method(Order, "findOne", async () => ({
    _id: ORDER_ID,
    orderNumber: "NIA-TEST",
    paymentMethod: "razorpay",
    orderStatus: "pending_payment",
    paymentStatus: "pending",
    totalAmount: 1250,
  }));
  t.mock.method(Payment, "create", async (data) => {
    savedPayment = {
      ...data,
      _id: "507f1f77bcf86cd799439013",
      save: async () => {},
    };
    return savedPayment;
  });
  t.mock.method(Order, "updateOne", async () => ({ modifiedCount: 1 }));
  t.mock.method(console, "error", () => {});

  await assert.rejects(
    createRazorpayPaymentOrder(USER_ID, ORDER_ID, "payment-test-401"),
    (error) => {
      assert.equal(error.statusCode, 502);
      assert.match(error.message, /Razorpay rejected the server credentials/);
      return true;
    }
  );
  assert.equal(savedPayment.status, "failed");
  assert.equal(savedPayment.failureCode, "RAZORPAY_ORDER_CREATION_FAILED");
});
