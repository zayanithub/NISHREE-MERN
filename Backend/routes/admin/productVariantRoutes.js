import { Router } from "express";

import {
  createProductVariantController,
  getProductVariantsController,
  getProductVariantController,
  updateProductVariantController,
  updateProductVariantStatusController,
  deleteProductVariantController,
} from "../../controllers/productVariantController.js";

import adminAuthMiddleware from "../../middlewares/adminAuthMiddleware.js";
import requirePermission from "../../middlewares/requirePermission.js";

const router = Router();

/*
|--------------------------------------------------------------------------
| Admin Authentication
|--------------------------------------------------------------------------
*/

router.use(adminAuthMiddleware);

/*
|--------------------------------------------------------------------------
| GET /api/v1/admin/products/:productId/variants
|--------------------------------------------------------------------------
| View all variants belonging to a product.
| Permission: products.read
|--------------------------------------------------------------------------
*/

router.get(
  "/:productId/variants",
  requirePermission("products", "read"),
  getProductVariantsController
);

/*
|--------------------------------------------------------------------------
| GET /api/v1/admin/products/:productId/variants/:variantId
|--------------------------------------------------------------------------
| View one specific variant.
| Permission: products.read
|--------------------------------------------------------------------------
*/

router.get(
  "/:productId/variants/:variantId",
  requirePermission("products", "read"),
  getProductVariantController
);

/*
|--------------------------------------------------------------------------
| POST /api/v1/admin/products/:productId/variants
|--------------------------------------------------------------------------
| Create a new variant.
| Permission: products.create
|--------------------------------------------------------------------------
*/

router.post(
  "/:productId/variants",
  requirePermission("products", "create"),
  createProductVariantController
);

/*
|--------------------------------------------------------------------------
| PATCH /api/v1/admin/products/:productId/variants/:variantId
|--------------------------------------------------------------------------
| Update variant details.
| Permission: products.update
|--------------------------------------------------------------------------
*/

router.patch(
  "/:productId/variants/:variantId",
  requirePermission("products", "update"),
  updateProductVariantController
);

/*
|--------------------------------------------------------------------------
| PATCH /api/v1/admin/products/:productId/variants/:variantId/status
|--------------------------------------------------------------------------
| Activate / deactivate a variant.
| Permission: products.update
|--------------------------------------------------------------------------
*/

router.patch(
  "/:productId/variants/:variantId/status",
  requirePermission("products", "update"),
  updateProductVariantStatusController
);

/*
|--------------------------------------------------------------------------
| DELETE /api/v1/admin/products/:productId/variants/:variantId
|--------------------------------------------------------------------------
| Soft delete / deactivate variant.
| Permission: products.delete
|--------------------------------------------------------------------------
*/

router.delete(
  "/:productId/variants/:variantId",
  requirePermission("products", "delete"),
  deleteProductVariantController
);

export default router;