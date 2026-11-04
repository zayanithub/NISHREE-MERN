import {
  uploadProductImages as uploadProductImagesService,
  listProductImages as listProductImagesService,
  setPrimaryProductImage as setPrimaryProductImageService,
  deleteProductImage as deleteProductImageService,
  removePrimaryProductImage as removePrimaryProductImageService,
} from "../service/productImageService.js";

/*
|--------------------------------------------------------------------------
| 1. Upload Product Images
|--------------------------------------------------------------------------
| POST /api/v1/admin/products/:productId/images
|
| Expected multipart/form-data:
|   images   -> One or more image files
|   altTexts -> Optional alt text or JSON array of alt texts
|--------------------------------------------------------------------------
*/

export const uploadProductImagesController = async (
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

    const images = await uploadProductImagesService(
      req.params.productId,
      req.files,
      req.admin.adminId,
      req.body?.altTexts
    );

    return res.status(201).json({
      success: true,
      message: "Product images uploaded successfully.",
      count: images.length,
      images,
    });
  } catch (error) {
    return next(error);
  }
};

/*
|--------------------------------------------------------------------------
| 2. List Product Images
|--------------------------------------------------------------------------
| GET /api/v1/admin/products/:productId/images
|--------------------------------------------------------------------------
*/

export const getProductImagesController = async (
  req,
  res,
  next
) => {
  try {
    const images = await listProductImagesService(
      req.params.productId
    );

    return res.status(200).json({
      success: true,
      message: "Product images retrieved successfully.",
      count: images.length,
      images,
    });
  } catch (error) {
    return next(error);
  }
};

/*
|--------------------------------------------------------------------------
| 3. Set Primary Product Image
|--------------------------------------------------------------------------
| PATCH /api/v1/admin/products/:productId/images/:imageId/primary
|--------------------------------------------------------------------------
*/

export const setPrimaryProductImageController = async (
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

    const image = await setPrimaryProductImageService(
      req.params.productId,
      req.params.imageId,
      req.admin.adminId
    );

    return res.status(200).json({
      success: true,
      message: "Primary product image updated successfully.",
      image,
    });
  } catch (error) {
    return next(error);
  }
};

/*
|--------------------------------------------------------------------------
| 4. Delete Product Image
|--------------------------------------------------------------------------
| DELETE /api/v1/admin/products/:productId/images/:imageId
|--------------------------------------------------------------------------
*/

export const deleteProductImageController = async (
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

    const result = await deleteProductImageService(
      req.params.productId,
      req.params.imageId,
      req.admin.adminId
    );

    return res.status(200).json({
      success: true,
      message: result.message,
      image: {
        id: result.id,
        productId: result.productId,
      },
    });
  } catch (error) {
    return next(error);
  }
};

export const removePrimaryProductImageController = async (
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

    const product = await removePrimaryProductImageService(
      req.params.productId,
      req.admin.adminId
    );

    return res.status(200).json({
      success: true,
      message: "Primary product image removed successfully.",
      product,
    });
  } catch (error) {
    return next(error);
  }
};