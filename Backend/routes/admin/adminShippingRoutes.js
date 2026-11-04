import { Router } from "express";

import {
  createShipmentController,
  listAdminShipmentsController,
  listEligibleOrdersForShippingController,
  getAdminShipmentByIdController,
  updateShipmentDetailsController,
  updateShipmentStatusController,
} from "../../controllers/shippingController.js";

import adminAuthMiddleware from "../../middlewares/adminAuthMiddleware.js";
import requirePermission from "../../middlewares/requirePermission.js";

const router = Router();

/*
|--------------------------------------------------------------------------
| Admin Shipping Routes
|--------------------------------------------------------------------------
|
| All routes require an authenticated admin.
| Each operation also requires the appropriate permission.
|
*/

router.use(adminAuthMiddleware);

/*
|--------------------------------------------------------------------------
| 1. Create Shipment
|--------------------------------------------------------------------------
| POST /api/v1/admin/shipping
| Permission: shipping.create
|--------------------------------------------------------------------------
*/

router.post(
  "/",
  requirePermission("shipping", "create"),
  createShipmentController
);

/*
|--------------------------------------------------------------------------
| 2. List Shipments
|--------------------------------------------------------------------------
| GET /api/v1/admin/shipping
| Permission: shipping.read
|--------------------------------------------------------------------------
*/

router.get(
  "/",
  requirePermission("shipping", "read"),
  listAdminShipmentsController
);

router.get(
  "/eligible-orders",
  requirePermission("shipping", "read"),
  listEligibleOrdersForShippingController
);

/*
|--------------------------------------------------------------------------
| 3. Get Shipment By ID
|--------------------------------------------------------------------------
| GET /api/v1/admin/shipping/:shippingId
| Permission: shipping.read
|--------------------------------------------------------------------------
*/

router.get(
  "/:shippingId",
  requirePermission("shipping", "read"),
  getAdminShipmentByIdController
);

/*
|--------------------------------------------------------------------------
| 4. Update Shipment Details
|--------------------------------------------------------------------------
| PATCH /api/v1/admin/shipping/:shippingId
| Permission: shipping.update
|--------------------------------------------------------------------------
*/

router.patch(
  "/:shippingId",
  requirePermission("shipping", "update"),
  updateShipmentDetailsController
);

/*
|--------------------------------------------------------------------------
| 5. Update Shipment Status
|--------------------------------------------------------------------------
| PATCH /api/v1/admin/shipping/:shippingId/status
| Permission: shipping.update
|--------------------------------------------------------------------------
*/

router.patch(
  "/:shippingId/status",
  requirePermission("shipping", "update"),
  updateShipmentStatusController
);

export default router;