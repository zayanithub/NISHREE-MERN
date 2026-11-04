import AuditLog from "../models/AuditLog.js";

const OBJECT_ID_PATTERN = /^[a-f\d]{24}$/i;
const SAFE_REQUEST_ID_PATTERN = /^[a-zA-Z0-9_-]{1,100}$/;

const sanitizeAuditChanges = (changes) => {
  if (!changes || typeof changes !== "object") {
    return null;
  }
  const sanitized = {};
  if (typeof changes.method === "string") {
    sanitized.method = changes.method.slice(0, 10);
  }
  if (
    Number.isInteger(changes.statusCode) &&
    changes.statusCode >= 100 &&
    changes.statusCode <= 599
  ) {
    sanitized.statusCode = changes.statusCode;
  }
  return Object.keys(sanitized).length ? sanitized : null;
};

const writeAuditLog = async (entry) => {
  try {
    await AuditLog.create(entry);
  } catch (error) {
    console.error("Audit log write failed:", error.message);
  }
};

export const recordAuditEvent = async ({
  actorType = "system",
  adminUser = null,
  user = null,
  action,
  resource,
  resourceId = null,
  description = "",
  ipAddress = null,
  requestId = null,
  status = "success",
  changes = null,
}) => {
  if (!["admin", "customer", "system"].includes(actorType)) {
    throw new Error("Invalid audit actor type.");
  }
  if (!["success", "failure"].includes(status)) {
    throw new Error("Invalid audit event status.");
  }
  if (!/^[a-z][a-z0-9_.-]{0,99}$/i.test(String(action || ""))) {
    throw new Error("Invalid audit action.");
  }
  if (!/^[a-z][a-z0-9_.-]{0,99}$/i.test(String(resource || ""))) {
    throw new Error("Invalid audit resource.");
  }

  await writeAuditLog({
    actorType,
    adminUser:
      typeof adminUser === "string" && OBJECT_ID_PATTERN.test(adminUser)
        ? adminUser
        : null,
    user:
      typeof user === "string" && OBJECT_ID_PATTERN.test(user) ? user : null,
    action: String(action).slice(0, 100),
    resource: String(resource).slice(0, 100),
    resourceId:
      typeof resourceId === "string" && OBJECT_ID_PATTERN.test(resourceId)
        ? resourceId
        : null,
    description: String(description || "").slice(0, 1000),
    ipAddress: typeof ipAddress === "string" ? ipAddress.slice(0, 100) : null,
    requestId:
      typeof requestId === "string" &&
      SAFE_REQUEST_ID_PATTERN.test(requestId)
        ? requestId
        : null,
    changes: sanitizeAuditChanges(changes),
    status,
  });
};

const getAdminResource = (req) => {
  const adminPath = String(req.baseUrl || req.path || "").match(
    /\/api\/v\d+\/admin\/([a-z0-9-]+)/i
  );
  const resource = adminPath?.[1] || "admin";
  return /^[a-z0-9-]{1,80}$/i.test(resource) ? resource : "admin";
};

const getResourceId = (params = {}) => {
  for (const [key, value] of Object.entries(params)) {
    if (
      key !== "adminId" &&
      typeof value === "string" &&
      OBJECT_ID_PATTERN.test(value)
    ) {
      return value;
    }
  }
  return null;
};

export const auditAdminRequest = (req, res, next) => {
  res.once("finish", () => {
    const isMutation = !["GET", "HEAD", "OPTIONS"].includes(req.method);
    const isFailure = res.statusCode >= 400;
    if (!isMutation && !isFailure) {
      return;
    }

    const resource = getAdminResource(req);
    void recordAuditEvent({
      actorType: "admin",
      adminUser: req.admin?.adminId,
      action: `admin.${req.method.toLowerCase()}.${resource}`,
      resource,
      resourceId: getResourceId(req.params),
      description: `Administrator ${req.method.toUpperCase()} ${resource} request`,
      ipAddress: req.ip,
      requestId: req.get("x-request-id"),
      status: res.statusCode < 400 ? "success" : "failure",
      changes: {
        method: req.method,
        statusCode: res.statusCode,
      },
    });
  });
  next();
};

export const listAdminAuditLogs = async ({
  page,
  limit,
  actorType,
  action,
  resource,
  status,
  from,
  to,
}) => {
  const now = new Date();
  const end = to ? new Date(to) : now;
  const start = from
    ? new Date(from)
    : new Date(end.getTime() - 30 * 24 * 60 * 60 * 1000);
  if (
    Number.isNaN(start.getTime()) ||
    Number.isNaN(end.getTime()) ||
    start > end
  ) {
    const error = new Error("Audit log date range is invalid.");
    error.statusCode = 400;
    throw error;
  }
  if (end.getTime() - start.getTime() > 90 * 24 * 60 * 60 * 1000) {
    const error = new Error("Audit log date range cannot exceed 90 days.");
    error.statusCode = 400;
    throw error;
  }

  const filter = { createdAt: { $gte: start, $lte: end } };
  if (actorType) filter.actorType = actorType;
  if (action) filter.action = action;
  if (resource) filter.resource = resource;
  if (status) filter.status = status;

  const skip = (page - 1) * limit;
  const [storedLogs, total] = await Promise.all([
    AuditLog.find(filter)
      .select(
        "actorType adminUser user action resource resourceId description ipAddress requestId status createdAt changes"
      )
      .populate("adminUser", "name email")
      .populate("user", "name email")
      .sort({ createdAt: -1, _id: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),
    AuditLog.countDocuments(filter),
  ]);
  const logs = storedLogs.map((log) => ({
    ...log,
    changes: sanitizeAuditChanges(log.changes),
  }));
  return {
    logs,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
    dateRange: { from: start.toISOString(), to: end.toISOString() },
  };
};
