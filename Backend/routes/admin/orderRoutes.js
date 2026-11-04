import { Router } from "express";

import {
  listAdminOrdersController,
  getAdminOrderByIdController,
  updateAdminOrderStatusController,
} from "../../controllers/orderController.js";

import adminAuthMiddleware from "../../middlewares/adminAuthMiddleware.js";
import requirePermission from "../../middlewares/requirePermission.js";

const router = Router();

/*
|--------------------------------------------------------------------------
| Admin Order Routes
|--------------------------------------------------------------------------
|
| All endpoints require an authenticated admin and the
| appropriate orders permission.
|
*/

router.use(adminAuthMiddleware);

/*
|--------------------------------------------------------------------------
| 1. List Orders
|--------------------------------------------------------------------------
| GET /api/v1/admin/orders
|
| Optional query parameters:
| page, limit, status, paymentStatus, search
|--------------------------------------------------------------------------
*/

router.get(
  "/",
  requirePermission("orders", "read"),
  listAdminOrdersController
);

/*
|--------------------------------------------------------------------------
| 2. Get Order By ID
|--------------------------------------------------------------------------
| GET /api/v1/admin/orders/:orderId
|--------------------------------------------------------------------------
*/

router.get(
  "/:orderId",
  requirePermission("orders", "read"),
  getAdminOrderByIdController
);

/*
|--------------------------------------------------------------------------
| 3. Update Order Status
|--------------------------------------------------------------------------
| PATCH /api/v1/admin/orders/:orderId/status
|
| Request body:
| {
|   "status": "processing"
| }
|--------------------------------------------------------------------------
*/

router.patch(
  "/:orderId/status",
  requirePermission("orders", "update"),
  updateAdminOrderStatusController
);

export default router;