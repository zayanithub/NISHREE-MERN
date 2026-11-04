import { Router } from "express";

import { listAdminAuditLogsController } from "../../controllers/adminAuditLogController.js";
import adminAuthMiddleware from "../../middlewares/adminAuthMiddleware.js";
import requirePermission from "../../middlewares/requirePermission.js";

const router = Router();

router.use(adminAuthMiddleware);
router.use(requirePermission("audit_logs", "read"));
router.get("/", listAdminAuditLogsController);

export default router;
