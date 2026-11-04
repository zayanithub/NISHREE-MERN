import { Router } from "express";

import {
  getWishlistController,
  addWishlistProductController,
  removeWishlistProductController,
  clearWishlistController,
} from "../controllers/wishlistController.js";

import authMiddleware from "../middlewares/authMiddleware.js";

const router = Router();

/*
|--------------------------------------------------------------------------
| Customer Wishlist Routes
|--------------------------------------------------------------------------
|
| All wishlist endpoints require customer authentication.
| Admin tokens and anonymous guest requests are not accepted.
|
*/

router.use(authMiddleware);

/*
|--------------------------------------------------------------------------
| 1. Get Customer Wishlist
|--------------------------------------------------------------------------
| GET /api/v1/wishlist
|--------------------------------------------------------------------------
*/

router.get(
  "/",
  getWishlistController
);

/*
|--------------------------------------------------------------------------
| 2. Add Product To Wishlist
|--------------------------------------------------------------------------
| POST /api/v1/wishlist/products
|
| Request body:
| {
|   "productId": "PRODUCT_ID"
| }
|--------------------------------------------------------------------------
*/

router.post(
  "/products",
  addWishlistProductController
);

/*
|--------------------------------------------------------------------------
| 3. Remove Product From Wishlist
|--------------------------------------------------------------------------
| DELETE /api/v1/wishlist/products/:productId
|--------------------------------------------------------------------------
*/

router.delete(
  "/products/:productId",
  removeWishlistProductController
);

/*
|--------------------------------------------------------------------------
| 4. Clear Wishlist
|--------------------------------------------------------------------------
| DELETE /api/v1/wishlist
|--------------------------------------------------------------------------
*/

router.delete(
  "/",
  clearWishlistController
);

export default router;