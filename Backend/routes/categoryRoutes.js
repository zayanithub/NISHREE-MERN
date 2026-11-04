import { Router } from "express";

import {
  getPublicCategories,
  getPublicCategoryBySlug,
} from "../controllers/categoryController.js";

const router = Router();

/*
|--------------------------------------------------------------------------
| GET /api/v1/categories
|--------------------------------------------------------------------------
| List active categories.
| Supports pagination, search and filtering.
*/

router.get("/", getPublicCategories);

/*
|--------------------------------------------------------------------------
| GET /api/v1/categories/:slug
|--------------------------------------------------------------------------
| Get an active category by its slug.
|
| Example:
| /api/v1/categories/silk-sarees
*/

router.get("/:slug", getPublicCategoryBySlug);

export default router;