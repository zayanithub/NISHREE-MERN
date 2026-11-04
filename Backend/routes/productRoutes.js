import { Router } from "express";

import {
  getPublicProducts,
  getPublicProductBySlug,
} from "../controllers/productController.js";
import {
  listPublicProductReviewsController,
} from "../controllers/reviewController.js";

const router = Router();

/*
|--------------------------------------------------------------------------
| GET /api/v1/products
|--------------------------------------------------------------------------
| Public product listing.
| Supports search, filtering, sorting and pagination.
*/

router.get("/", getPublicProducts);

router.get("/:slug/reviews", listPublicProductReviewsController);

/*
|--------------------------------------------------------------------------
| GET /api/v1/products/:slug
|--------------------------------------------------------------------------
| Get an active product by its slug.
*/

router.get("/:slug", getPublicProductBySlug);

export default router;