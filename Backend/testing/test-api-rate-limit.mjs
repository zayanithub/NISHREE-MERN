import test from "node:test";
import assert from "node:assert/strict";

import app, { API_RATE_LIMIT } from "../app.js";

test("general API limiter allows a normal storefront browsing burst", () => {
  assert.ok(
    API_RATE_LIMIT >= 150,
    "the general API limit should allow at least 150 requests per 15 minutes"
  );
});

test("trusts the single Render proxy hop for client IP rate limiting", () => {
  assert.equal(app.get("trust proxy"), 1);
});
