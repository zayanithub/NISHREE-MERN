import { Router } from "express";

import {
  getAdminProducts,
  getAdminProductById,
  createProduct,
  updateProduct,
  updateProductStatus,
  deleteProduct,
} from "../../controllers/productController.js";

import adminAuthMiddleware from "../../middlewares/adminAuthMiddleware.js";
import requirePermission from "../../middlewares/requirePermission.js";
import validate from "../../middlewares/validateMiddleware.js";

import {
  createProductSchema,
  updateProductSchema,
  updateProductStatusSchema,
} from "../../validations/productValidation.js";

const router = Router();

/*
|--------------------------------------------------------------------------
| All admin product routes require authentication.
|--------------------------------------------------------------------------
*/

router.use(adminAuthMiddleware);

/*
|--------------------------------------------------------------------------
| GET /api/v1/admin/products
|--------------------------------------------------------------------------
| Admin product listing:
| draft, active and archived products.
*/

router.get(
  "/",
  requirePermission("products", "read"),
  getAdminProducts
);

/*
|--------------------------------------------------------------------------
| POST /api/v1/admin/products
|--------------------------------------------------------------------------
| Create a product.
*/

router.post(
  "/",
  requirePermission("products", "create"),
  validate(createProductSchema),
  createProduct
);

/*
|--------------------------------------------------------------------------
| PATCH /api/v1/admin/products/:productId/status
|--------------------------------------------------------------------------
| Change product status:
| draft, active or archived.
*/

router.patch(
  "/:productId/status",
  requirePermission("products", "update"),
  validate(updateProductStatusSchema),
  updateProductStatus
);

/*
|--------------------------------------------------------------------------
| PATCH /api/v1/admin/products/:productId
|--------------------------------------------------------------------------
| Update product details.
*/

router.patch(
  "/:productId",
  requirePermission("products", "update"),
  validate(updateProductSchema),
  updateProduct
);

/*
|--------------------------------------------------------------------------
| DELETE /api/v1/admin/products/:productId
|--------------------------------------------------------------------------
| Archives the product instead of permanently deleting it.
*/

router.delete(
  "/:productId",
  requirePermission("products", "delete"),
  deleteProduct
);

/*
|--------------------------------------------------------------------------
| GET /api/v1/admin/products/:productId
|--------------------------------------------------------------------------
| Retrieve a product by its MongoDB ID.
*/

router.get(
  "/:productId",
  requirePermission("products", "read"),
  getAdminProductById
);

export default router;