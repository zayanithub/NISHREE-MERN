import { Router } from "express";

import {
  createInventoryController,
  listInventoryController,
  getInventoryByIdController,
  getInventoryByProductController,
  getInventoryByVariantController,
  adjustInventoryQuantityController,
  updateInventoryThresholdController,
  listLowStockInventoryController,
} from "../../controllers/inventoryController.js";

import adminAuthMiddleware from "../../middlewares/adminAuthMiddleware.js";
import requirePermission from "../../middlewares/requirePermission.js";

const router = Router();

/*
|--------------------------------------------------------------------------
| Admin Authentication
|--------------------------------------------------------------------------
|
| All inventory routes require an authenticated admin.
|
*/

router.use(adminAuthMiddleware);

/*
|--------------------------------------------------------------------------
| 1. List Low-Stock Inventory
|--------------------------------------------------------------------------
| GET /api/v1/admin/inventory/low-stock
|--------------------------------------------------------------------------
*/

router.get(
  "/low-stock",
  requirePermission("inventory", "read"),
  listLowStockInventoryController
);

/*
|--------------------------------------------------------------------------
| 2. Get Product-Level Inventory
|--------------------------------------------------------------------------
| GET /api/v1/admin/inventory/product/:productId
|--------------------------------------------------------------------------
*/

router.get(
  "/product/:productId",
  requirePermission("inventory", "read"),
  getInventoryByProductController
);

/*
|--------------------------------------------------------------------------
| 3. Get Variant-Level Inventory
|--------------------------------------------------------------------------
| GET /api/v1/admin/inventory/variant/:variantId
|--------------------------------------------------------------------------
*/

router.get(
  "/variant/:variantId",
  requirePermission("inventory", "read"),
  getInventoryByVariantController
);

/*
|--------------------------------------------------------------------------
| 4. List All Inventory
|--------------------------------------------------------------------------
| GET /api/v1/admin/inventory
|--------------------------------------------------------------------------
*/

router.get(
  "/",
  requirePermission("inventory", "read"),
  listInventoryController
);

/*
|--------------------------------------------------------------------------
| 5. Create Inventory
|--------------------------------------------------------------------------
| POST /api/v1/admin/inventory
|--------------------------------------------------------------------------
*/

router.post(
  "/",
  requirePermission("inventory", "create"),
  createInventoryController
);

/*
|--------------------------------------------------------------------------
| 6. Adjust Inventory Quantity
|--------------------------------------------------------------------------
| PATCH /api/v1/admin/inventory/:inventoryId/adjust
|--------------------------------------------------------------------------
*/

router.patch(
  "/:inventoryId/adjust",
  requirePermission("inventory", "update"),
  adjustInventoryQuantityController
);

/*
|--------------------------------------------------------------------------
| 7. Update Low-Stock Threshold
|--------------------------------------------------------------------------
| PATCH /api/v1/admin/inventory/:inventoryId/threshold
|--------------------------------------------------------------------------
*/

router.patch(
  "/:inventoryId/threshold",
  requirePermission("inventory", "update"),
  updateInventoryThresholdController
);

/*
|--------------------------------------------------------------------------
| 8. Get Inventory By ID
|--------------------------------------------------------------------------
| GET /api/v1/admin/inventory/:inventoryId
|--------------------------------------------------------------------------
*/

router.get(
  "/:inventoryId",
  requirePermission("inventory", "read"),
  getInventoryByIdController
);

export default router;