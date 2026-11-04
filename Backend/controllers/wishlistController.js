import {
  getWishlist as getWishlistService,
  addWishlistProduct as addWishlistProductService,
  removeWishlistProduct as removeWishlistProductService,
  clearWishlist as clearWishlistService,
} from "../service/wishlistService.js";

/*
|--------------------------------------------------------------------------
| Common Helper
|--------------------------------------------------------------------------
*/

const requireCustomer = (req, res) => {
  const userId = req.auth?.userId;

  if (!userId || req.auth?.accountType !== "user") {
    res.status(401).json({
      success: false,
      message: "Customer authentication required.",
    });

    return null;
  }

  return userId;
};

/*
|--------------------------------------------------------------------------
| 1. Get Customer Wishlist
|--------------------------------------------------------------------------
| GET /api/v1/wishlist
|--------------------------------------------------------------------------
*/

export const getWishlistController = async (
  req,
  res,
  next
) => {
  try {
    const userId = requireCustomer(req, res);

    if (!userId) {
      return;
    }

    const wishlist = await getWishlistService(userId);

    return res.status(200).json({
      success: true,
      message: "Wishlist retrieved successfully.",
      wishlist,
    });
  } catch (error) {
    return next(error);
  }
};

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

export const addWishlistProductController = async (
  req,
  res,
  next
) => {
  try {
    const userId = requireCustomer(req, res);

    if (!userId) {
      return;
    }

    const body = req.validatedBody ?? req.body;

    const wishlist = await addWishlistProductService(
      userId,
      body?.productId
    );

    return res.status(200).json({
      success: true,
      message: "Product added to wishlist successfully.",
      wishlist,
    });
  } catch (error) {
    return next(error);
  }
};

/*
|--------------------------------------------------------------------------
| 3. Remove Product From Wishlist
|--------------------------------------------------------------------------
| DELETE /api/v1/wishlist/products/:productId
|--------------------------------------------------------------------------
*/

export const removeWishlistProductController = async (
  req,
  res,
  next
) => {
  try {
    const userId = requireCustomer(req, res);

    if (!userId) {
      return;
    }

    const wishlist = await removeWishlistProductService(
      userId,
      req.params.productId
    );

    return res.status(200).json({
      success: true,
      message: "Product removed from wishlist successfully.",
      wishlist,
    });
  } catch (error) {
    return next(error);
  }
};

/*
|--------------------------------------------------------------------------
| 4. Clear Customer Wishlist
|--------------------------------------------------------------------------
| DELETE /api/v1/wishlist
|--------------------------------------------------------------------------
*/

export const clearWishlistController = async (
  req,
  res,
  next
) => {
  try {
    const userId = requireCustomer(req, res);

    if (!userId) {
      return;
    }

    const wishlist = await clearWishlistService(userId);

    return res.status(200).json({
      success: true,
      message: "Wishlist cleared successfully.",
      wishlist,
    });
  } catch (error) {
    return next(error);
  }
};