import test from "node:test";
import assert from "node:assert/strict";
import mongoose from "mongoose";

import ExchangeRequest from "../models/ExchangeRequest.js";
import Inventory from "../models/Inventory.js";
import {
  settleExchangePriceDifference,
  transitionAdminExchangeRequest,
} from "../service/adminExchangeService.js";

const EXCHANGE_REQUEST_ID = "507f1f77bcf86cd799439012";
const ADMIN_ID = "507f1f77bcf86cd799439011";

const mockTransactionSession = (t) =>
  t.mock.method(mongoose, "startSession", async () => ({
    withTransaction: async (callback) => callback(),
    endSession: async () => {},
  }));

test("exchange reason details have a single empty-string default", () => {
  assert.equal(
    ExchangeRequest.schema.path("reasonDetails").defaultValue,
    ""
  );

  const request = new ExchangeRequest({
    reasonDetails: "  Size does not fit  ",
  });

  assert.equal(request.reasonDetails, "Size does not fit");
});

test("rejects an exchange transition that is not valid for its current state", async (t) => {
  mockTransactionSession(t);

  t.mock.method(ExchangeRequest, "findById", () => ({
    session: () => ({
      lean: async () => ({
        _id: EXCHANGE_REQUEST_ID,
        status: "requested",
      }),
    }),
  }));

  await assert.rejects(
    transitionAdminExchangeRequest(
      EXCHANGE_REQUEST_ID,
      { status: "replacement_pending" }
    ),
    (error) => {
      assert.equal(error.statusCode, 409);
      assert.match(error.message, /cannot transition/i);
      return true;
    }
  );
});

test("allows inspection-passed exchanges to enter replacement_pending", async (t) => {
  mockTransactionSession(t);

  t.mock.method(ExchangeRequest, "findById", () => ({
    session: () => ({
      lean: async () => ({
        _id: EXCHANGE_REQUEST_ID,
        status: "inspection_passed",
        priceDifferenceStatus: "not_applicable",
        requestedProduct: "507f1f77bcf86cd799439013",
        requestedVariant: null,
        quantity: 1,
      }),
    }),
  }));

  t.mock.method(Inventory, "findOneAndUpdate", (filter, update, options) => {
    assert.equal(filter.inventoryType, "product");
    assert.equal(update.$inc.reservedQuantity, 1);
    assert.ok(options.session);

    return {
      lean: async () => ({
        _id: "507f1f77bcf86cd799439014",
      }),
    };
  });

  t.mock.method(ExchangeRequest, "findOneAndUpdate", (filter, update, options) => {
    assert.equal(filter._id, EXCHANGE_REQUEST_ID);
    assert.equal(filter.status, "inspection_passed");
    assert.equal(update.$set.status, "replacement_pending");
    assert.equal(
      update.$set.replacementInventoryReserved,
      true
    );
    assert.ok(options.session);

    return {
      lean: async () => ({
        _id: EXCHANGE_REQUEST_ID,
        user: "507f1f77bcf86cd799439016",
        order: "507f1f77bcf86cd799439017",
        status: update.$set.status,
      }),
    };
  });

  const result = await transitionAdminExchangeRequest(
    EXCHANGE_REQUEST_ID,
    { status: "replacement_pending" }
  );

  assert.equal(result.status, "replacement_pending");
});

test("requires price-difference settlement before replacement shipment", async (t) => {
  mockTransactionSession(t);

  t.mock.method(ExchangeRequest, "findById", () => ({
    session: () => ({
      lean: async () => ({
        _id: EXCHANGE_REQUEST_ID,
        status: "replacement_pending",
        priceDifference: 150,
        priceDifferenceStatus: "pending",
        replacementInventoryReserved: true,
        replacementInventory: "507f1f77bcf86cd799439015",
        quantity: 1,
      }),
    }),
  }));

  await assert.rejects(
    transitionAdminExchangeRequest(
      EXCHANGE_REQUEST_ID,
      {
        status: "replacement_shipped",
        replacementCarrier: "Carrier",
        replacementTrackingNumber: "TRACK-1",
      }
    ),
    (error) => {
      assert.equal(error.statusCode, 409);
      assert.match(error.message, /settle the exchange price difference/i);
      return true;
    }
  );
});

test("commits reserved replacement stock before marking it shipped", async (t) => {
  mockTransactionSession(t);

  t.mock.method(ExchangeRequest, "findById", () => ({
    session: () => ({
      lean: async () => ({
        _id: EXCHANGE_REQUEST_ID,
        status: "replacement_pending",
        priceDifference: 0,
        priceDifferenceStatus: "not_applicable",
        replacementInventoryReserved: true,
        replacementInventory: "507f1f77bcf86cd799439015",
        quantity: 2,
      }),
    }),
  }));

  t.mock.method(Inventory, "updateOne", async (filter, update, options) => {
    assert.equal(filter.quantity.$gte, 2);
    assert.equal(filter.reservedQuantity.$gte, 2);
    assert.equal(update.$inc.quantity, -2);
    assert.equal(update.$inc.reservedQuantity, -2);
    assert.ok(options.session);
    return { modifiedCount: 1 };
  });

  t.mock.method(ExchangeRequest, "findOneAndUpdate", (filter, update) => ({
    lean: async () => ({
      _id: EXCHANGE_REQUEST_ID,
      user: "507f1f77bcf86cd799439016",
      order: "507f1f77bcf86cd799439017",
      status: update.$set.status,
      replacementInventoryReserved:
        update.$set.replacementInventoryReserved,
    }),
  }));

  const result = await transitionAdminExchangeRequest(
    EXCHANGE_REQUEST_ID,
    {
      status: "replacement_shipped",
      replacementCarrier: "Carrier",
      replacementTrackingNumber: "TRACK-2",
    }
  );

  assert.equal(result.status, "replacement_shipped");
  assert.equal(result.replacementInventoryReserved, false);
});

test("records only the required verified price-difference settlement", async (t) => {
  mockTransactionSession(t);

  t.mock.method(ExchangeRequest, "findById", () => ({
    session: () => ({
      lean: async () => ({
        _id: EXCHANGE_REQUEST_ID,
        status: "replacement_pending",
        priceDifference: -75,
        priceDifferenceStatus: "pending",
      }),
    }),
  }));

  t.mock.method(ExchangeRequest, "findOneAndUpdate", (filter, update, options) => {
    assert.equal(filter.priceDifferenceStatus, "pending");
    assert.equal(update.$set.priceDifferenceStatus, "refunded");
    assert.equal(update.$set.priceDifferenceReference, "PAYOUT-REF-1");
    assert.ok(options.session);
    return {
      lean: async () => ({
        _id: EXCHANGE_REQUEST_ID,
        ...update.$set,
      }),
    };
  });

  const result = await settleExchangePriceDifference(
    EXCHANGE_REQUEST_ID,
    ADMIN_ID,
    {
      status: "refunded",
      reference: "PAYOUT-REF-1",
    }
  );

  assert.equal(result.priceDifferenceStatus, "refunded");
  assert.equal(result.priceDifferenceReference, "PAYOUT-REF-1");
});
