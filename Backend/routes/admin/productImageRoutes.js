import { Router } from "express";

import {
  uploadProductImagesController,
  getProductImagesController,
  setPrimaryProductImageController,
  deleteProductImageController,
  removePrimaryProductImageController,
  reorderProductImagesController,
} from "../../controllers/productImageController.js";

import adminAuthMiddleware from "../../middlewares/adminAuthMiddleware.js";
import requirePermission from "../../middlewares/requirePermission.js";

import {
  uploadProductImages as uploadProductImagesMiddleware,
} from "../../middlewares/productImageUpload.js";

const router = Router();

/*
|--------------------------------------------------------------------------
| All product image routes require admin authentication.
|--------------------------------------------------------------------------
*/

router.use(adminAuthMiddleware);

/*
|--------------------------------------------------------------------------
| GET /api/v1/admin/products/:productId/images
|--------------------------------------------------------------------------
| Retrieve all images belonging to a product.
| Required permission: products:read
|--------------------------------------------------------------------------
*/

router.get(
  "/:productId/images",
  requirePermission("products", "read"),
  getProductImagesController
);

/*
|--------------------------------------------------------------------------
| POST /api/v1/admin/products/:productId/images
|--------------------------------------------------------------------------
| Upload one or more images to Cloudinary.
| Required permission: products:update
|
| Content-Type: multipart/form-data
| File field: images
|--------------------------------------------------------------------------
*/

router.post(
  "/:productId/images",
  requirePermission("products", "update"),
  uploadProductImagesMiddleware,
  uploadProductImagesController
);

/*
|--------------------------------------------------------------------------
| PATCH /api/v1/admin/products/:productId/images/:imageId/primary
|--------------------------------------------------------------------------
| Select the primary product image.
| Required permission: products:update
|--------------------------------------------------------------------------
*/

router.patch(
  "/:productId/images/:imageId/primary",
  requirePermission("products", "update"),
  setPrimaryProductImageController
);

router.patch(
  "/:productId/images/order",
  requirePermission("products", "update"),
  reorderProductImagesController
);

/*
|--------------------------------------------------------------------------
| DELETE /api/v1/admin/products/:productId/images/:imageId
|--------------------------------------------------------------------------
| Delete an image from Cloudinary and MongoDB.
| Required permission: products:update
|--------------------------------------------------------------------------
*/

router.delete(
  "/:productId/images/:imageId",
  requirePermission("products", "update"),
  deleteProductImageController
);

router.delete(
  "/:productId/primary-image",
  requirePermission("products", "update"),
  removePrimaryProductImageController
);

export default router;