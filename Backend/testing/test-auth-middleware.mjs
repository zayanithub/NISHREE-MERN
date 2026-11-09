import test from "node:test";
import assert from "node:assert/strict";
import jwt from "jsonwebtoken";
import app from "../app.js";
import AdminUser from "../models/AdminUser.js";
import adminAuthMiddleware from "../middlewares/adminAuthMiddleware.js";
import authMiddleware from "../middlewares/authMiddleware.js";

const JWT_SECRET = "middleware-test-secret-with-at-least-32-bytes";

const runMiddleware = (authorization) => {
  const req = { headers: authorization ? { authorization } : {} };
  const result = { statusCode: null, body: null, nextCalled: false };
  const res = {
    status(statusCode) {
      result.statusCode = statusCode;
      return this;
    },
    json(body) {
      result.body = body;
      return this;
    },
  };
  const next = (error) => {
    result.nextCalled = true;
    result.error = error;
  };
  authMiddleware(req, res, next);
  return { ...result, requestAuth: req.auth };
};

const runAdminMiddleware = async (authorization) => {
  const req = {
    headers: authorization ? { authorization } : {},
    method: "GET",
    baseUrl: "/api/v1/admin/dashboard",
    path: "/",
    params: {},
    ip: "127.0.0.1",
    get: () => undefined,
  };
  const result = { statusCode: null, body: null, nextCalled: false };
  const res = {
    status(statusCode) {
      result.statusCode = statusCode;
      return this;
    },
    json(body) {
      result.body = body;
      return this;
    },
    once() {
      return this;
    },
  };
  const next = (error) => {
    result.nextCalled = true;
    result.error = error;
  };

  await adminAuthMiddleware(req, res, next);
  return { ...result, requestAdmin: req.admin };
};

test("auth middleware distinguishes missing customer credentials for refresh recovery", (t) => {
  const previousSecret = process.env.JWT_ACCESS_SECRET;
  process.env.JWT_ACCESS_SECRET = JWT_SECRET;
  t.after(() => {
    if (previousSecret === undefined) delete process.env.JWT_ACCESS_SECRET;
    else process.env.JWT_ACCESS_SECRET = previousSecret;
  });

  const missing = runMiddleware(undefined);
  assert.equal(missing.statusCode, 401);
  assert.equal(missing.body.code, "AUTHENTICATION_REQUIRED");

  const invalid = runMiddleware("Bearer invalid-token");
  assert.equal(invalid.statusCode, 401);
  assert.equal(invalid.body.code, "ACCESS_TOKEN_INVALID");

  const token = jwt.sign(
    { sub: "507f1f77bcf86cd799439011", accountType: "user" },
    JWT_SECRET,
    {
      expiresIn: "5m",
      issuer: "nishree-attaire-api",
      audience: "nishree-attaire-client",
    }
  );
  const valid = runMiddleware(`Bearer ${token}`);
  assert.equal(valid.nextCalled, true);
  assert.deepEqual(valid.requestAuth, {
    userId: "507f1f77bcf86cd799439011",
    accountType: "user",
  });
});

test("admin middleware rejects customer tokens and requires an active database admin role", async (t) => {
  const previousSecret = process.env.JWT_ACCESS_SECRET;
  process.env.JWT_ACCESS_SECRET = JWT_SECRET;
  t.after(() => {
    if (previousSecret === undefined) delete process.env.JWT_ACCESS_SECRET;
    else process.env.JWT_ACCESS_SECRET = previousSecret;
  });

  const signToken = (accountType) =>
    jwt.sign(
      { sub: "507f1f77bcf86cd799439011", accountType },
      JWT_SECRET,
      {
        expiresIn: "5m",
        issuer: "nishree-attaire-api",
        audience: "nishree-attaire-client",
      }
    );

  const customerToken = signToken("user");
  const customer = await runAdminMiddleware(`Bearer ${customerToken}`);
  assert.equal(customer.statusCode, 403);
  assert.equal(customer.nextCalled, false);

  const adminToken = signToken("admin");
  let databaseAdmin = null;
  const query = {
    select() {
      return this;
    },
    populate() {
      return this;
    },
    then(resolve, reject) {
      return Promise.resolve(databaseAdmin).then(resolve, reject);
    },
  };
  t.mock.method(AdminUser, "findById", () => query);
  const missingAdminRecord = await runAdminMiddleware(`Bearer ${adminToken}`);
  assert.equal(missingAdminRecord.statusCode, 403);
  assert.equal(missingAdminRecord.nextCalled, false);

  databaseAdmin = { status: "active", role: { isActive: true } };
  const activeAdmin = await runAdminMiddleware(`Bearer ${adminToken}`);
  assert.equal(activeAdmin.nextCalled, true);
  assert.deepEqual(activeAdmin.requestAdmin, {
    adminId: "507f1f77bcf86cd799439011",
    accountType: "admin",
  });
});

test("payment setup returns a refreshable auth error when no access token is sent", async (t) => {
  const server = app.listen(0, "127.0.0.1");
  await new Promise((resolve, reject) => {
    server.once("listening", resolve);
    server.once("error", reject);
  });
  t.after(
    () =>
      new Promise((resolve) => {
        server.close(resolve);
        server.closeAllConnections();
      })
  );

  const response = await fetch(
    `http://127.0.0.1:${server.address().port}/api/v1/payments/razorpay/order`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ orderId: "507f1f77bcf86cd799439011" }),
    }
  );
  const body = await response.json();

  assert.equal(response.status, 401);
  assert.equal(body.code, "AUTHENTICATION_REQUIRED");
});
