import { Router } from "express";

import {
  getCartController,
  addCartItemController,
  updateCartItemQuantityController,
  removeCartItemController,
  clearCartController,
} from "../controllers/cartController.js";

import optionalAuthMiddleware from "../middlewares/optionalAuthMiddleware.js";

const router = Router();

/*
|--------------------------------------------------------------------------
| Customer Cart Routes
|--------------------------------------------------------------------------
|
| Logged-in customers:
|   Cart is associated with their authenticated user ID.
|
| Guest customers:
|   Cart is associated with a secure guest session cookie.
|
*/

router.use(optionalAuthMiddleware);

/*
|--------------------------------------------------------------------------
| 1. Get Cart
|--------------------------------------------------------------------------
| GET /api/v1/cart
|--------------------------------------------------------------------------
*/

router.get(
  "/",
  getCartController
);

/*
|--------------------------------------------------------------------------
| 2. Add Item To Cart
|--------------------------------------------------------------------------
| POST /api/v1/cart/items
|--------------------------------------------------------------------------
*/

router.post(
  "/items",
  addCartItemController
);

/*
|--------------------------------------------------------------------------
| 3. Update Cart Item Quantity
|--------------------------------------------------------------------------
| PATCH /api/v1/cart/items/:itemId
|--------------------------------------------------------------------------
*/

router.patch(
  "/items/:itemId",
  updateCartItemQuantityController
);

/*
|--------------------------------------------------------------------------
| 4. Remove Cart Item
|--------------------------------------------------------------------------
| DELETE /api/v1/cart/items/:itemId
|--------------------------------------------------------------------------
*/

router.delete(
  "/items/:itemId",
  removeCartItemController
);

/*
|--------------------------------------------------------------------------
| 5. Clear Cart
|--------------------------------------------------------------------------
| DELETE /api/v1/cart
|--------------------------------------------------------------------------
*/

router.delete(
  "/",
  clearCartController
);

export default router;