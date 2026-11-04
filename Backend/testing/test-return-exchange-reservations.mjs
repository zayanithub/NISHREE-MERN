import test from "node:test";
import assert from "node:assert/strict";

import ExchangeRequest from "../models/ExchangeRequest.js";
import ReturnExchangeReservation from "../models/ReturnExchangeReservation.js";
import ReturnRequest from "../models/ReturnRequest.js";
import {
  completeReturnExchangeQuantity,
  releaseReturnExchangeQuantity,
  reserveReturnExchangeQuantity,
} from "../service/returnExchangeReservationService.js";

const ORDER_ID = "507f1f77bcf86cd799439011";
const ITEM_ID = "507f1f77bcf86cd799439012";

const queryWith = (value) => {
  const query = {
    select() {
      return this;
    },
    session() {
      return this;
    },
    lean: async () => value,
  };

  return query;
};

const mockEmptyLegacyRequests = (t) => {
  t.mock.method(ReturnRequest, "find", () =>
    queryWith([])
  );
  t.mock.method(ExchangeRequest, "find", () =>
    queryWith([])
  );
};

test("shares an atomic quantity limit and releases cancelled reservations", async (t) => {
  mockEmptyLegacyRequests(t);

  let reservation = null;
  t.mock.method(ReturnExchangeReservation, "findOne", () =>
    queryWith(reservation)
  );

  t.mock.method(
    ReturnExchangeReservation,
    "findOneAndUpdate",
    (filter, update, options) => {
      assert.ok(options.session);

      if (options.upsert) {
        reservation = {
          order: ORDER_ID,
          orderItemId: ITEM_ID,
          purchasedQuantity: update.$setOnInsert.purchasedQuantity,
          reservedQuantity: update.$setOnInsert.reservedQuantity ?? 0,
          completedQuantity: update.$setOnInsert.completedQuantity ?? 0,
        };
      } else if (
        reservation.reservedQuantity +
          reservation.completedQuantity +
          filter.$expr.$lte[0].$add[1] <=
        reservation.purchasedQuantity
      ) {
        reservation.reservedQuantity += update.$inc.reservedQuantity;
      } else {
        return queryWith(null);
      }

      return queryWith({ ...reservation });
    }
  );

  t.mock.method(
    ReturnExchangeReservation,
    "updateOne",
    (filter, update) => {
      if (reservation.reservedQuantity < filter.reservedQuantity.$gte) {
        return { modifiedCount: 0 };
      }

      reservation.reservedQuantity +=
        update.$inc.reservedQuantity;

      if (update.$inc.completedQuantity) {
        reservation.completedQuantity +=
          update.$inc.completedQuantity;
      }

      return { modifiedCount: 1 };
    }
  );

  const session = {};
  await reserveReturnExchangeQuantity({
    orderId: ORDER_ID,
    orderItemId: ITEM_ID,
    purchasedQuantity: 3,
    quantity: 2,
    session,
  });

  await assert.rejects(
    reserveReturnExchangeQuantity({
      orderId: ORDER_ID,
      orderItemId: ITEM_ID,
      purchasedQuantity: 3,
      quantity: 2,
      session,
    }),
    (error) => {
      assert.equal(error.statusCode, 409);
      assert.match(error.message, /exceeds the remaining eligible quantity/i);
      return true;
    }
  );

  await releaseReturnExchangeQuantity({
    orderId: ORDER_ID,
    orderItemId: ITEM_ID,
    quantity: 1,
    session,
  });

  await reserveReturnExchangeQuantity({
    orderId: ORDER_ID,
    orderItemId: ITEM_ID,
    purchasedQuantity: 3,
    quantity: 2,
    session,
  });

  assert.equal(reservation.reservedQuantity, 3);
  assert.equal(reservation.completedQuantity, 0);
});

test("completed return/exchange quantities remain consumed", async (t) => {
  let reservation;

  t.mock.method(
    ReturnExchangeReservation,
    "updateOne",
    (filter, update) => {
      assert.equal(filter.reservedQuantity.$gte, 1);
      reservation.reservedQuantity +=
        update.$inc.reservedQuantity;
      reservation.completedQuantity +=
        update.$inc.completedQuantity;
      return { modifiedCount: 1 };
    }
  );

  reservation = {
    reservedQuantity: 1,
    completedQuantity: 0,
  };

  await completeReturnExchangeQuantity({
    orderId: ORDER_ID,
    orderItemId: ITEM_ID,
    quantity: 1,
    session: {},
  });

  assert.equal(reservation.reservedQuantity, 0);
  assert.equal(reservation.completedQuantity, 1);
});

test("bootstraps reservation counters from legacy open and completed requests", async (t) => {
  const legacyReturns = [
    { status: "requested", quantity: 1 },
    { status: "completed", quantity: 1 },
  ];
  const legacyExchanges = [
    { status: "inspection_failed", quantity: 1 },
    { status: "under_review", quantity: 1 },
  ];

  t.mock.method(ReturnRequest, "find", (filter) =>
    queryWith(
      legacyReturns.filter((request) =>
        filter.status.$in.includes(request.status)
      )
    )
  );
  t.mock.method(ExchangeRequest, "find", (filter) =>
    queryWith(
      legacyExchanges.filter((request) =>
        filter.status.$in.includes(request.status)
      )
    )
  );
  t.mock.method(ReturnExchangeReservation, "findOne", () =>
    queryWith(null)
  );

  let initialized;
  t.mock.method(
    ReturnExchangeReservation,
    "findOneAndUpdate",
    (filter, update, options) => {
      if (!options.upsert) {
        return queryWith(null);
      }

      assert.equal(options.upsert, true);
      initialized = update.$setOnInsert;
      return queryWith({
        ...initialized,
        order: ORDER_ID,
        orderItemId: ITEM_ID,
      });
    }
  );

  await assert.rejects(
    reserveReturnExchangeQuantity({
      orderId: ORDER_ID,
      orderItemId: ITEM_ID,
      purchasedQuantity: 3,
      quantity: 1,
      session: {},
    }),
    (error) => {
      assert.equal(error.statusCode, 409);
      return true;
    }
  );

  assert.equal(initialized.reservedQuantity, 2);
  assert.equal(initialized.completedQuantity, 1);
});
