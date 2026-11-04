import { listAdminAuditLogs } from "../service/auditLogService.js";
import { auditLogQuerySchema } from "../validations/auditLogValidation.js";

export const listAdminAuditLogsController = async (req, res, next) => {
  try {
    const parsed = auditLogQuerySchema.safeParse(req.query);
    if (!parsed.success) {
      const error = new Error(
        parsed.error.issues.map((issue) => issue.message).join("; ")
      );
      error.statusCode = 400;
      throw error;
    }

    const result = await listAdminAuditLogs(parsed.data);
    return res.status(200).json({
      success: true,
      message: "Audit logs retrieved successfully.",
      data: result,
    });
  } catch (error) {
    return next(error);
  }
};
