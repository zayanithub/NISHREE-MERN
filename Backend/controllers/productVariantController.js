import {
  createProductVariant,
  listProductVariants,
  getProductVariant,
  updateProductVariant,
  updateProductVariantStatus,
  deleteProductVariant,
} from "../service/productVariantService.js";

/*
|--------------------------------------------------------------------------
| Create Product Variant
|--------------------------------------------------------------------------
| POST /api/v1/admin/products/:productId/variants
|--------------------------------------------------------------------------
*/

export const createProductVariantController = async (
  req,
  res,
  next
) => {
  try {
    if (!req.admin?.adminId) {
      return res.status(401).json({
        success: false,
        message: "Admin authentication required.",
      });
    }

    const variant = await createProductVariant(
      req.params.productId,
      req.body,
      req.admin.adminId
    );

    return res.status(201).json({
      success: true,
      message: "Product variant created successfully.",
      variant,
    });
  } catch (error) {
    return next(error);
  }
};

/*
|--------------------------------------------------------------------------
| List Product Variants
|--------------------------------------------------------------------------
| GET /api/v1/admin/products/:productId/variants
|--------------------------------------------------------------------------
*/

export const getProductVariantsController = async (
  req,
  res,
  next
) => {
  try {
    const activeOnly =
      req.query.activeOnly === "true";

    const variants = await listProductVariants(
      req.params.productId,
      {
        activeOnly,
      }
    );

    return res.status(200).json({
      success: true,
      message: "Product variants retrieved successfully.",
      count: variants.length,
      variants,
    });
  } catch (error) {
    return next(error);
  }
};

/*
|--------------------------------------------------------------------------
| Get Single Product Variant
|--------------------------------------------------------------------------
| GET /api/v1/admin/products/:productId/variants/:variantId
|--------------------------------------------------------------------------
*/

export const getProductVariantController = async (
  req,
  res,
  next
) => {
  try {
    const variant = await getProductVariant(
      req.params.productId,
      req.params.variantId
    );

    return res.status(200).json({
      success: true,
      message: "Product variant retrieved successfully.",
      variant,
    });
  } catch (error) {
    return next(error);
  }
};

/*
|--------------------------------------------------------------------------
| Update Product Variant
|--------------------------------------------------------------------------
| PATCH /api/v1/admin/products/:productId/variants/:variantId
|--------------------------------------------------------------------------
*/

export const updateProductVariantController = async (
  req,
  res,
  next
) => {
  try {
    if (!req.admin?.adminId) {
      return res.status(401).json({
        success: false,
        message: "Admin authentication required.",
      });
    }

    const variant = await updateProductVariant(
      req.params.productId,
      req.params.variantId,
      req.body,
      req.admin.adminId
    );

    return res.status(200).json({
      success: true,
      message: "Product variant updated successfully.",
      variant,
    });
  } catch (error) {
    return next(error);
  }
};

/*
|--------------------------------------------------------------------------
| Update Variant Status
|--------------------------------------------------------------------------
| PATCH /api/v1/admin/products/:productId/variants/:variantId/status
|--------------------------------------------------------------------------
*/

export const updateProductVariantStatusController =
  async (req, res, next) => {
    try {
      if (!req.admin?.adminId) {
        return res.status(401).json({
          success: false,
          message: "Admin authentication required.",
        });
      }

      if (
        typeof req.body?.isActive !== "boolean"
      ) {
        return res.status(400).json({
          success: false,
          message: "isActive must be a boolean.",
        });
      }

      const variant =
        await updateProductVariantStatus(
          req.params.productId,
          req.params.variantId,
          req.body.isActive,
          req.admin.adminId
        );

      return res.status(200).json({
        success: true,
        message:
          "Product variant status updated successfully.",
        variant,
      });
    } catch (error) {
      return next(error);
    }
  };

/*
|--------------------------------------------------------------------------
| Delete / Deactivate Variant
|--------------------------------------------------------------------------
| DELETE /api/v1/admin/products/:productId/variants/:variantId
|--------------------------------------------------------------------------
*/

export const deleteProductVariantController = async (
  req,
  res,
  next
) => {
  try {
    if (!req.admin?.adminId) {
      return res.status(401).json({
        success: false,
        message: "Admin authentication required.",
      });
    }

    const variant = await deleteProductVariant(
      req.params.productId,
      req.params.variantId,
      req.admin.adminId
    );

    return res.status(200).json({
      success: true,
      message: "Product variant deactivated successfully.",
      variant,
    });
  } catch (error) {
    return next(error);
  }
};