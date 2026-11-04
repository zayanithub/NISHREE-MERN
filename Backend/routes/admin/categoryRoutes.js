import { Router } from "express";

import {
  getAdminCategories,
  getAdminCategoryById,
  createCategory,
  updateCategory,
  updateCategoryStatus,
  deleteCategory,
} from "../../controllers/categoryController.js";

import adminAuthMiddleware from "../../middlewares/adminAuthMiddleware.js";
import requirePermission from "../../middlewares/requirePermission.js";
import validate from "../../middlewares/validateMiddleware.js";

import {
  createCategorySchema,
  updateCategorySchema,
  updateCategoryStatusSchema,
} from "../../validations/categoryValidation.js";

const router = Router();

/*
|--------------------------------------------------------------------------
| All admin category routes require authentication.
|--------------------------------------------------------------------------
*/

router.use(adminAuthMiddleware);

/*
|--------------------------------------------------------------------------
| GET /api/v1/admin/categories
|--------------------------------------------------------------------------
| View active and inactive categories.
*/

router.get(
  "/",
  requirePermission("categories", "read"),
  getAdminCategories
);

/*
|--------------------------------------------------------------------------
| POST /api/v1/admin/categories
|--------------------------------------------------------------------------
| Create a category.
*/

router.post(
  "/",
  requirePermission("categories", "create"),
  validate(createCategorySchema),
  createCategory
);

/*
|--------------------------------------------------------------------------
| PATCH /api/v1/admin/categories/:categoryId/status
|--------------------------------------------------------------------------
| Activate or deactivate a category.
*/

router.patch(
  "/:categoryId/status",
  requirePermission("categories", "update"),
  validate(updateCategoryStatusSchema),
  updateCategoryStatus
);

/*
|--------------------------------------------------------------------------
| PATCH /api/v1/admin/categories/:categoryId
|--------------------------------------------------------------------------
| Update category details.
*/

router.patch(
  "/:categoryId",
  requirePermission("categories", "update"),
  validate(updateCategorySchema),
  updateCategory
);

/*
|--------------------------------------------------------------------------
| DELETE /api/v1/admin/categories/:categoryId
|--------------------------------------------------------------------------
| Delete a category when no products or child categories reference it.
*/

router.delete(
  "/:categoryId",
  requirePermission("categories", "delete"),
  deleteCategory
);

/*
|--------------------------------------------------------------------------
| GET /api/v1/admin/categories/:categoryId
|--------------------------------------------------------------------------
| View a category by its MongoDB ID.
*/

router.get(
  "/:categoryId",
  requirePermission("categories", "read"),
  getAdminCategoryById
);

export default router;