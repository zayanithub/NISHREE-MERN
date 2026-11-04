import { createHash, randomBytes } from "node:crypto";

import {
  getCart as getCartService,
  addCartItem as addCartItemService,
  updateCartItemQuantity as updateCartItemQuantityService,
  removeCartItem as removeCartItemService,
  clearCart as clearCartService,
} from "../service/cartService.js";

/*
|--------------------------------------------------------------------------
| Guest Cart Session Configuration
|--------------------------------------------------------------------------
*/

const GUEST_CART_COOKIE = "nishree_guest_cart";

const GUEST_CART_MAX_AGE =
  30 * 24 * 60 * 60 * 1000; // 30 days

/*
|--------------------------------------------------------------------------
| Build Cart Identity
|--------------------------------------------------------------------------
|
| Authenticated customer:
|   Uses req.auth.userId.
|
| Guest customer:
|   Uses a random token stored in an HttpOnly cookie.
|   Only the SHA-256 hash is passed to the cart service.
|--------------------------------------------------------------------------
*/

const getCartIdentity = (req, res) => {
  if (req.auth?.userId) {
    return {
      userId: req.auth.userId,
    };
  }

  let guestToken =
    req.cookies?.[GUEST_CART_COOKIE];

  /*
   * A 32-byte base64url token is 43 characters long.
   * Replace missing or malformed tokens.
   */
  if (
    typeof guestToken !== "string" ||
    !/^[A-Za-z0-9_-]{43}$/.test(guestToken)
  ) {
    guestToken = randomBytes(32).toString("base64url");

    res.cookie(
      GUEST_CART_COOKIE,
      guestToken,
      {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        path: "/",
        maxAge: GUEST_CART_MAX_AGE,
      }
    );
  }

  const sessionIdHash = createHash("sha256")
    .update(guestToken)
    .digest("hex");

  return {
    sessionIdHash,
  };
};

/*
|--------------------------------------------------------------------------
| 1. Get Cart
|--------------------------------------------------------------------------
| GET /api/v1/cart
|--------------------------------------------------------------------------
*/

export const getCartController = async (
  req,
  res,
  next
) => {
  try {
    const identity = getCartIdentity(req, res);

    const cart = await getCartService(identity);

    return res.status(200).json({
      success: true,
      message: "Cart retrieved successfully.",
      cart,
    });
  } catch (error) {
    return next(error);
  }
};

/*
|--------------------------------------------------------------------------
| 2. Add Item To Cart
|--------------------------------------------------------------------------
| POST /api/v1/cart/items
|
| Request body:
| {
|   "product": "PRODUCT_ID",
|   "variant": "VARIANT_ID",
|   "quantity": 1
| }
|
| If the product has active variants, a variant must be selected.
|--------------------------------------------------------------------------
*/

export const addCartItemController = async (
  req,
  res,
  next
) => {
  try {
    const identity = getCartIdentity(req, res);

    const body = req.validatedBody ?? req.body;

    const cart = await addCartItemService(
      identity,
      {
        product: body?.product,
        variant: body?.variant,
        quantity: body?.quantity ?? 1,
      }
    );

    return res.status(200).json({
      success: true,
      message: "Item added to cart successfully.",
      cart,
    });
  } catch (error) {
    return next(error);
  }
};

/*
|--------------------------------------------------------------------------
| 3. Update Cart Item Quantity
|--------------------------------------------------------------------------
| PATCH /api/v1/cart/items/:itemId
|
| Request body:
| {
|   "quantity": 2
| }
|--------------------------------------------------------------------------
*/

export const updateCartItemQuantityController = async (
  req,
  res,
  next
) => {
  try {
    const identity = getCartIdentity(req, res);

    const body = req.validatedBody ?? req.body;

    const cart = await updateCartItemQuantityService(
      identity,
      req.params.itemId,
      body?.quantity
    );

    return res.status(200).json({
      success: true,
      message: "Cart item quantity updated successfully.",
      cart,
    });
  } catch (error) {
    return next(error);
  }
};

/*
|--------------------------------------------------------------------------
| 4. Remove Cart Item
|--------------------------------------------------------------------------
| DELETE /api/v1/cart/items/:itemId
|--------------------------------------------------------------------------
*/

export const removeCartItemController = async (
  req,
  res,
  next
) => {
  try {
    const identity = getCartIdentity(req, res);

    const cart = await removeCartItemService(
      identity,
      req.params.itemId
    );

    return res.status(200).json({
      success: true,
      message: "Cart item removed successfully.",
      cart,
    });
  } catch (error) {
    return next(error);
  }
};

/*
|--------------------------------------------------------------------------
| 5. Clear Cart
|--------------------------------------------------------------------------
| DELETE /api/v1/cart
|--------------------------------------------------------------------------
*/

export const clearCartController = async (
  req,
  res,
  next
) => {
  try {
    const identity = getCartIdentity(req, res);

    const cart = await clearCartService(identity);

    return res.status(200).json({
      success: true,
      message: "Cart cleared successfully.",
      cart,
    });
  } catch (error) {
    return next(error);
  }
};