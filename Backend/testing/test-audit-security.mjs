import { EventEmitter } from "node:events";
import test from "node:test";
import assert from "node:assert/strict";

import AuditLog from "../models/AuditLog.js";
import {
  auditAdminRequest,
  listAdminAuditLogs,
} from "../service/auditLogService.js";
import { auditLogQuerySchema } from "../validations/auditLogValidation.js";

const ADMIN_ID = "507f1f77bcf86cd799439011";
const ORDER_ID = "507f1f77bcf86cd799439012";

const queryWith = (value) => ({
  select(selection) {
    this.selection = selection;
    return this;
  },
  populate() {
    return this;
  },
  sort() {
    return this;
  },
  skip() {
    return this;
  },
  limit() {
    return this;
  },
  lean: async () => value,
});

test("audit query validation bounds filters, paging, and time range", () => {
  assert.equal(auditLogQuerySchema.parse({}).limit, 25);
  assert.equal(
    auditLogQuerySchema.safeParse({ page: "0" }).success,
    false
  );
  assert.equal(
    auditLogQuerySchema.safeParse({ limit: "101" }).success,
    false
  );
  assert.equal(
    auditLogQuerySchema.safeParse({
      secret: "should-not-be-accepted",
    }).success,
    false
  );
  assert.equal(
    auditLogQuerySchema.safeParse({
      from: "2026-01-01T00:00:00.000Z",
      to: "2026-04-15T00:00:00.000Z",
    }).success,
    false
  );
});

test("admin mutations and failed requests are audited without request bodies", async (t) => {
  const created = [];
  t.mock.method(AuditLog, "create", async (entry) => {
    created.push(entry);
    return entry;
  });

  const request = (method) => ({
    baseUrl: "/api/v1/admin/orders",
    method,
    params: { orderId: ORDER_ID },
    admin: { adminId: ADMIN_ID },
    ip: "192.0.2.4",
    headers: {
      "x-request-id": "request_123",
      authorization: "Bearer secret-token",
    },
    body: {
      password: "must-not-be-stored",
      refreshToken: "must-not-be-stored",
    },
    get(name) {
      return this.headers[name.toLowerCase()];
    },
  });

  const mutationResponse = new EventEmitter();
  mutationResponse.statusCode = 200;
  auditAdminRequest(request("PATCH"), mutationResponse, () => {});
  mutationResponse.emit("finish");

  const deniedResponse = new EventEmitter();
  deniedResponse.statusCode = 403;
  auditAdminRequest(request("GET"), deniedResponse, () => {});
  deniedResponse.emit("finish");

  const readResponse = new EventEmitter();
  readResponse.statusCode = 200;
  auditAdminRequest(request("GET"), readResponse, () => {});
  readResponse.emit("finish");

  await new Promise((resolve) => setImmediate(resolve));

  assert.equal(created.length, 2);
  assert.equal(created[0].action, "admin.patch.orders");
  assert.equal(created[0].resource, "orders");
  assert.equal(created[0].resourceId, ORDER_ID);
  assert.equal(created[0].adminUser, ADMIN_ID);
  assert.equal(created[0].status, "success");
  assert.deepEqual(created[0].changes, {
    method: "PATCH",
    statusCode: 200,
  });
  assert.equal(JSON.stringify(created).includes("must-not-be-stored"), false);
  assert.equal(created[1].status, "failure");
});

test("failed audit storage is surfaced through server logging without breaking the request", async (t) => {
  t.mock.method(AuditLog, "create", async () => {
    throw new Error("database unavailable");
  });
  const errors = [];
  t.mock.method(console, "error", (...args) => errors.push(args));

  const response = new EventEmitter();
  response.statusCode = 201;
  auditAdminRequest(
    {
      baseUrl: "/api/v1/admin/products",
      method: "POST",
      params: {},
      admin: { adminId: ADMIN_ID },
      ip: "192.0.2.8",
      headers: {},
      get() {
        return undefined;
      },
    },
    response,
    () => {}
  );
  response.emit("finish");
  await new Promise((resolve) => setImmediate(resolve));

  assert.equal(errors.length, 1);
  assert.match(errors[0][0], /Audit log write failed/);
});

test("audit log listing limits date range, paginates, and excludes raw changes", async (t) => {
  let filter;
  let selected;
  t.mock.method(AuditLog, "find", (value) => {
    filter = value;
    const query = queryWith([{
      action: "admin.patch.orders",
      changes: {
        method: "PATCH",
        statusCode: 200,
        password: "must-not-be-returned",
      },
    }]);
    const originalSelect = query.select;
    query.select = (selection) => {
      selected = selection;
      return originalSelect.call(query, selection);
    };
    return query;
  });
  t.mock.method(AuditLog, "countDocuments", async () => 1);

  const result = await listAdminAuditLogs({
    page: 2,
    limit: 10,
    actorType: "admin",
    action: "admin.patch.orders",
  });

  assert.equal(filter.actorType, "admin");
  assert.equal(filter.action, "admin.patch.orders");
  assert.ok(
    Date.now() - filter.createdAt.$gte.getTime() >=
      30 * 24 * 60 * 60 * 1000
  );
  assert.ok(filter.createdAt.$lte.getTime() <= Date.now());
  assert.equal(selected.includes("changes"), true);
  assert.deepEqual(result.logs[0].changes, {
    method: "PATCH",
    statusCode: 200,
  });
  assert.equal(
    JSON.stringify(result.logs).includes("must-not-be-returned"),
    false
  );
  assert.equal(result.pagination.page, 2);
  assert.equal(result.pagination.total, 1);
  assert.equal(result.logs.length, 1);
});

test("rejects invalid or overly broad audit ranges", async () => {
  await assert.rejects(
    listAdminAuditLogs({
      page: 1,
      limit: 10,
      from: "2026-05-01T00:00:00.000Z",
      to: "2026-01-01T00:00:00.000Z",
    }),
    { statusCode: 400 }
  );
});
