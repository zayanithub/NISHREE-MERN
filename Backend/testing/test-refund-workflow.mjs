import test from "node:test";
import assert from "node:assert/strict";
import mongoose from "mongoose";

import Order from "../models/Order.js";
import Payment from "../models/Payment.js";
import Refund from "../models/Refund.js";
import ReturnExchangeReservation from "../models/ReturnExchangeReservation.js";
import ReturnRequest from "../models/ReturnRequest.js";
import {
  createRefundForReturnRequest,
  listAdminRefunds,
  processApprovedRefund,
  rejectRefund,
} from "../service/refundService.js";

const ADMIN_ID = "507f1f77bcf86cd799439011";
const REFUND_ID = "507f1f77bcf86cd799439012";
const RETURN_ID = "507f1f77bcf86cd799439013";
const ORDER_ID = "507f1f77bcf86cd799439014";
const ITEM_ID = "507f1f77bcf86cd799439015";
const CUSTOMER_ID = "507f1f77bcf86cd799439016";

const queryWith = (value) => ({
  select() {
    return this;
  },
  session() {
    return this;
  },
  lean: async () => value,
});

const mockTransactionSession = (t) =>
  t.mock.method(mongoose, "startSession", async () => ({
    withTransaction: async (callback) => callback(),
    endSession: async () => {},
  }));

test("rejects only a requested refund linked to an eligible return and records the reason", async (t) => {
  const currentRefund = {
    _id: REFUND_ID,
    status: "requested",
    user: CUSTOMER_ID,
    order: ORDER_ID,
    refundNumber: "NIA-REF-2026-1",
    metadata: { returnRequestId: RETURN_ID },
  };
  let update;

  t.mock.method(Refund, "findById", async () => currentRefund);
  t.mock.method(ReturnRequest, "findOne", (filter) => {
    assert.equal(String(filter._id), RETURN_ID);
    assert.equal(String(filter.refund), REFUND_ID);
    assert.equal(filter.status, "refund_pending");
    return { lean: async () => ({ _id: RETURN_ID }) };
  });
  t.mock.method(Refund, "findOneAndUpdate", async (filter, operation) => {
    assert.equal(String(filter._id), REFUND_ID);
    assert.equal(filter.status, "requested");
    update = operation;
    return {
      toObject: () => ({
        ...currentRefund,
        ...operation.$set,
      }),
    };
  });

  const result = await rejectRefund(ADMIN_ID, REFUND_ID, {
    rejectionReason: "The submitted return does not meet the refund policy.",
  });

  assert.equal(result.status, "rejected");
  assert.equal(result.rejectionReason, "The submitted return does not meet the refund policy.");
  assert.equal(String(result.rejectedBy), ADMIN_ID);
  assert.ok(update.$set.rejectedAt instanceof Date);
});

test("creates COD return refunds as manual payouts, never as gateway refunds", async (t) => {
  mockTransactionSession(t);

  t.mock.method(ReturnRequest, "findById", async () => ({
    _id: RETURN_ID,
    returnNumber: "NIA-RET-1",
    status: "refund_pending",
    user: "507f1f77bcf86cd799439016",
    order: ORDER_ID,
    orderItemId: ITEM_ID,
    quantity: 1,
    reasonDetails: "",
  }));
  t.mock.method(Order, "findById", () =>
    queryWith({
      _id: ORDER_ID,
      user: "507f1f77bcf86cd799439016",
      paymentMethod: "cod",
      paymentStatus: "paid",
      totalAmount: 200,
      items: [
        {
          _id: ITEM_ID,
          quantity: 2,
          unitPrice: 100,
          lineTotal: 200,
        },
      ],
    })
  );
  t.mock.method(Refund, "find", () =>
    queryWith([])
  );
  t.mock.method(Payment, "find", () => {
    throw new Error("COD refunds must not query Razorpay payments");
  });
  t.mock.method(Refund, "create", async (refundData) => {
    const refundFields = refundData[0];
    assert.equal(refundFields.payment, null);
    assert.equal(refundFields.refundMethod, "manual");
    assert.equal(refundFields.amount, 100);
    assert.equal(refundFields.status, "requested");
    return [{
      ...refundFields,
      _id: REFUND_ID,
      toObject() {
        return { ...refundFields, _id: REFUND_ID };
      },
    }];
  });
  t.mock.method(
    Order,
    "findOneAndUpdate",
    async (filter, update, options) => {
      assert.equal(filter._id, ORDER_ID);
      assert.equal(filter.$expr.$lte[0].$add.at(-1), 100);
      assert.equal(
        update.$inc.manualRefundReservedAmount,
        100
      );
      assert.ok(options.session);
      return {
        manualRefundAmount: 0,
        manualRefundReservedAmount: 0,
      };
    }
  );
  t.mock.method(ReturnRequest, "findOneAndUpdate", async () => ({}));

  const refund = await createRefundForReturnRequest(
    ADMIN_ID,
    RETURN_ID
  );

  assert.equal(refund.refundMethod, "manual");
  assert.equal(refund.amount, 100);
});

test("lists refunds with bounded pagination and supported filters", async (t) => {
  const query = {
    populate() {
      return this;
    },
    sort(sort) {
      assert.deepEqual(sort, { createdAt: -1, _id: -1 });
      return this;
    },
    skip(amount) {
      assert.equal(amount, 20);
      return this;
    },
    limit(amount) {
      assert.equal(amount, 10);
      return this;
    },
    lean: async () => [{ _id: REFUND_ID }],
  };

  t.mock.method(Refund, "find", (filter) => {
    assert.equal(filter.status, "processing");
    assert.equal(filter.refundMethod, "manual");
    assert.equal(filter.order, ORDER_ID);
    return query;
  });
  t.mock.method(Refund, "countDocuments", async (filter) => {
    assert.equal(filter.status, "processing");
    return 21;
  });

  const result = await listAdminRefunds({
    page: "3",
    limit: "10",
    status: "processing",
    refundMethod: "manual",
    orderId: ORDER_ID,
  });

  assert.deepEqual(result, {
    refunds: [{ _id: REFUND_ID }],
    pagination: {
      page: 3,
      limit: 10,
      total: 21,
      totalPages: 3,
    },
  });
});

test("rejects unsupported refund-list filters", async () => {
  await assert.rejects(
    listAdminRefunds({ status: "not-a-status" }),
    (error) => error.statusCode === 400
  );

  await assert.rejects(
    listAdminRefunds({ limit: 101 }),
    (error) => error.statusCode === 400
  );
});

test("does not create a COD refund until cash collection is confirmed", async (t) => {
  t.mock.method(ReturnRequest, "findById", async () => ({
    _id: RETURN_ID,
    status: "refund_pending",
    user: "507f1f77bcf86cd799439016",
    order: ORDER_ID,
    orderItemId: ITEM_ID,
    quantity: 1,
  }));
  t.mock.method(Order, "findById", () =>
    queryWith({
      _id: ORDER_ID,
      user: "507f1f77bcf86cd799439016",
      paymentMethod: "cod",
      paymentStatus: "pending",
      totalAmount: 200,
      items: [
        {
          _id: ITEM_ID,
          quantity: 2,
          unitPrice: 100,
          lineTotal: 200,
        },
      ],
    })
  );

  await assert.rejects(
    createRefundForReturnRequest(ADMIN_ID, RETURN_ID),
    (error) => {
      assert.equal(error.statusCode, 409);
      assert.match(error.message, /cash collection is confirmed/i);
      return true;
    }
  );
});

test("allows a failed refund to be replaced without unlinking its audit record", async (t) => {
  mockTransactionSession(t);

  const oldRefundId = "507f1f77bcf86cd799439017";
  t.mock.method(ReturnRequest, "findById", async () => ({
    _id: RETURN_ID,
    returnNumber: "NIA-RET-2",
    refund: oldRefundId,
    status: "refund_pending",
    user: "507f1f77bcf86cd799439016",
    order: ORDER_ID,
    orderItemId: ITEM_ID,
    quantity: 1,
    reasonDetails: "",
  }));
  t.mock.method(Refund, "findById", async () => ({
    _id: oldRefundId,
    status: "failed",
  }));
  t.mock.method(Order, "findById", () =>
    queryWith({
      _id: ORDER_ID,
      user: "507f1f77bcf86cd799439016",
      paymentMethod: "razorpay",
      totalAmount: 100,
      items: [
        {
          _id: ITEM_ID,
          quantity: 1,
          unitPrice: 100,
          lineTotal: 100,
        },
      ],
    })
  );
  t.mock.method(Payment, "find", () =>
    queryWith([
      {
        _id: "507f1f77bcf86cd799439018",
        amount: 100,
        refundAmount: 0,
        refundReservedAmount: 0,
      },
    ])
  );

  t.mock.method(Refund, "create", async (refundData) => {
    const fields = refundData[0];
    return [{
      ...fields,
      _id: REFUND_ID,
      toObject() {
        return { ...fields, _id: REFUND_ID };
      },
    }];
  });
  t.mock.method(Order, "findOneAndUpdate", async () => ({
    manualRefundAmount: 0,
    manualRefundReservedAmount: 0,
  }));
  t.mock.method(
    ReturnRequest,
    "findOneAndUpdate",
    async (filter, update) => {
      assert.equal(filter.refund, oldRefundId);
      assert.equal(update.$set.refund, REFUND_ID);
      return { refund: REFUND_ID };
    }
  );

  const refund = await createRefundForReturnRequest(
    ADMIN_ID,
    RETURN_ID
  );

  assert.equal(refund.status, "requested");
  assert.equal(refund._id, REFUND_ID);
});

test("claims manual COD payout before recording its verified completion", async (t) => {
  mockTransactionSession(t);

  const processingRefund = {
    _id: REFUND_ID,
    order: ORDER_ID,
    amount: 50,
    refundMethod: "manual",
    metadata: {
      returnRequestId: RETURN_ID,
    },
    toObject() {
      return { ...this };
    },
  };

  t.mock.method(Refund, "findById", async () => ({
    ...processingRefund,
    status: "approved",
  }));
  t.mock.method(Refund, "findOneAndUpdate", async (filter, update) => ({
    ...processingRefund,
    status: update.$set.status,
    metadata: update.$set.metadata,
  }));

  const claimed = await processApprovedRefund(
    ADMIN_ID,
    REFUND_ID
  );

  assert.equal(claimed.status, "processing");
  assert.equal(claimed.refundMethod, "manual");
});

test("manual payout failure is recorded so the return can be retried", async (t) => {
  mockTransactionSession(t);

  const processingRefund = {
    _id: REFUND_ID,
    order: ORDER_ID,
    amount: 50,
    refundMethod: "manual",
    status: "processing",
    metadata: {
      returnRequestId: RETURN_ID,
    },
  };

  t.mock.method(Refund, "findById", async () => processingRefund);
  t.mock.method(Refund, "findOneAndUpdate", async (filter, update) => {
    assert.equal(filter.status, "processing");
    assert.equal(update.$set.status, "failed");
    assert.equal(
      update.$set.failureReason,
      "Bank rejected the transfer"
    );
    return {
      ...processingRefund,
      ...update.$set,
      toObject() {
        return { ...this };
      },
    };
  });
  t.mock.method(Order, "updateOne", async () => ({
    modifiedCount: 1,
  }));

  const refund = await processApprovedRefund(
    ADMIN_ID,
    REFUND_ID,
    { failureReason: "Bank rejected the transfer" }
  );

  assert.equal(refund.status, "failed");
});

test("records COD payout reference and completes the linked return atomically", async (t) => {
  mockTransactionSession(t);

  const existingRefund = {
    _id: REFUND_ID,
    order: ORDER_ID,
    amount: 50,
    refundMethod: "manual",
    status: "processing",
    metadata: {
      returnRequestId: RETURN_ID,
    },
    toObject() {
      return { ...this };
    },
  };

  t.mock.method(Refund, "findById", async () => existingRefund);
  t.mock.method(
    Refund,
    "findOneAndUpdate",
    async (filter, update, options) => {
      assert.equal(filter.status, "processing");
      assert.equal(update.$set.manualPayoutMethod, "bank_transfer");
      assert.equal(update.$set.manualPayoutReference, "BANK-REF-123");
      assert.ok(options.session);
      return {
        ...existingRefund,
        ...update.$set,
      };
    }
  );
  t.mock.method(ReturnRequest, "findOneAndUpdate", () => ({
    lean: async () => ({
      order: ORDER_ID,
      orderItemId: ITEM_ID,
      quantity: 1,
      status: "completed",
    }),
  }));
  t.mock.method(
    ReturnExchangeReservation,
    "updateOne",
    async (_filter, update, options) => {
      assert.equal(update.$inc.reservedQuantity, -1);
      assert.equal(update.$inc.completedQuantity, 1);
      assert.ok(options.session);
      return { modifiedCount: 1 };
    }
  );
  t.mock.method(Refund, "find", () =>
    queryWith([{ amount: 50 }])
  );
  t.mock.method(Order, "findOneAndUpdate", () =>
    queryWith({ totalAmount: 200 })
  );
  t.mock.method(Order, "updateOne", async (_filter, update) => {
    assert.equal(
      update.$set.paymentStatus,
      "partially_refunded"
    );
    return { modifiedCount: 1 };
  });

  const refund = await processApprovedRefund(
    ADMIN_ID,
    REFUND_ID,
    {
      method: "bank_transfer",
      reference: "BANK-REF-123",
    }
  );

  assert.equal(refund.status, "processed");
  assert.equal(refund.manualPayoutMethod, "bank_transfer");
});

test("manual refunds do not require a Razorpay Payment reference", async () => {
  const manualRefund = new Refund({
    refundNumber: "NIA-REF-TEST",
    order: ORDER_ID,
    payment: null,
    refundType: "partial",
    reason: "product_return",
    amount: 25,
    refundMethod: "manual",
  });

  await manualRefund.validate();

  const gatewayRefund = new Refund({
    refundNumber: "NIA-REF-GATEWAY",
    order: ORDER_ID,
    refundType: "partial",
    reason: "product_return",
    amount: 25,
    refundMethod: "original_payment",
  });

  await assert.rejects(
    gatewayRefund.validate(),
    (error) => Boolean(error.errors.payment)
  );
});
