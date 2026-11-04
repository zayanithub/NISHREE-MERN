import test from "node:test";
import assert from "node:assert/strict";
import mongoose from "mongoose";

import ReturnRequest from "../models/ReturnRequest.js";

import {
  transitionAdminReturnRequest,
} from "../service/adminReturnService.js";

const ADMIN_ID = "507f1f77bcf86cd799439011";
const RETURN_REQUEST_ID = "507f1f77bcf86cd799439012";

/*
|--------------------------------------------------------------------------
| Test 1: inspection_passed -> refund_pending
|--------------------------------------------------------------------------
|
| Mock database methods so this test does not modify
| MongoDB data or initiate any real refund.
|--------------------------------------------------------------------------
*/

test(
  "allows inspection_passed -> refund_pending",
  async (t) => {
    t.mock.method(mongoose, "startSession", async () => ({
      withTransaction: async (callback) => callback(),
      endSession: async () => {},
    }));

    const currentRequest = {
      _id: RETURN_REQUEST_ID,
      status: "inspection_passed",
      inspectionNotes: "Inspection passed",
    };

    t.mock.method(
      ReturnRequest,
      "findById",
      () => ({
        session: async () => currentRequest,
      })
    );

    t.mock.method(
      ReturnRequest,
      "findOneAndUpdate",
      async (filter, update, options) => {
        assert.ok(options.session);
        assert.equal(
          filter.status,
          "inspection_passed"
        );

        assert.equal(
          update.$set.status,
          "refund_pending"
        );

        return {
          _id: RETURN_REQUEST_ID,
            user: "507f1f77bcf86cd799439016",
            order: "507f1f77bcf86cd799439017",
            ...update.$set,

            toObject() {
              return {
                _id: RETURN_REQUEST_ID,
                user: "507f1f77bcf86cd799439016",
                order: "507f1f77bcf86cd799439017",
                ...update.$set,
            };
          },
        };
      }
    );

    const result = await transitionAdminReturnRequest(
      ADMIN_ID,
      RETURN_REQUEST_ID,
      {
        status: "refund_pending",
      }
    );

    assert.equal(
      result.status,
      "refund_pending"
    );

    assert.equal(
      result.reviewedBy,
      ADMIN_ID
    );
  }
);

/*
|--------------------------------------------------------------------------
| Test 2: Invalid transition must be rejected
|--------------------------------------------------------------------------
|
| A new request cannot jump directly to refund_pending.
|--------------------------------------------------------------------------
*/

test(
  "rejects requested -> refund_pending",
  async (t) => {
    t.mock.method(mongoose, "startSession", async () => ({
      withTransaction: async (callback) => callback(),
      endSession: async () => {},
    }));

    t.mock.method(
      ReturnRequest,
      "findById",
      () => ({
        session: async () => ({
          _id: RETURN_REQUEST_ID,
          status: "requested",
          inspectionNotes: "",
        }),
      })
    );

    const promise = transitionAdminReturnRequest(
      ADMIN_ID,
      RETURN_REQUEST_ID,
      {
        status: "refund_pending",
      }
    );

    await assert.rejects(
      promise,
      (error) => {
        assert.equal(error.statusCode, 409);

        assert.match(
          error.message,
          /cannot transition/i
        );

        return true;
      }
    );
  }
);

/*
|--------------------------------------------------------------------------
| Test 3: Unknown status must be rejected
|--------------------------------------------------------------------------
*/

test(
  "rejects an unknown workflow status",
  async () => {
    await assert.rejects(
      transitionAdminReturnRequest(
        ADMIN_ID,
        RETURN_REQUEST_ID,
        {
          status: "invalid_status",
        }
      ),
      (error) => {
        assert.equal(error.statusCode, 400);

        assert.equal(
          error.message,
          "Invalid return workflow status."
        );

        return true;
      }
    );
  }
);