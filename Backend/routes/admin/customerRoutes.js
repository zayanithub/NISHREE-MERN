import { Router } from "express";
import { getAdminCustomerController, listAdminCustomersController } from "../../controllers/adminCustomerController.js";
import adminAuthMiddleware from "../../middlewares/adminAuthMiddleware.js";
import requirePermission from "../../middlewares/requirePermission.js";

const router = Router();
router.use(adminAuthMiddleware, requirePermission("customers", "read"));
router.get("/", listAdminCustomersController);
router.get("/:customerId", getAdminCustomerController);
export default router;
