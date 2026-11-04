import { Router } from "express";

import {
  getAdminDashboardInventoryController,
  getAdminDashboardOverviewController,
  getAdminDashboardSalesController,
} from "../../controllers/adminDashboardController.js";
import adminAuthMiddleware from "../../middlewares/adminAuthMiddleware.js";
import requirePermission from "../../middlewares/requirePermission.js";

const router = Router();

router.use(adminAuthMiddleware);
router.use(requirePermission("dashboard", "read"));

router.get("/overview", getAdminDashboardOverviewController);
router.get("/sales", getAdminDashboardSalesController);
router.get("/inventory-alerts", getAdminDashboardInventoryController);

export default router;
