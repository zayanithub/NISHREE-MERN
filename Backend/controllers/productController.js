import {
  listProducts as listProductsService,
  getProductBySlug as getProductBySlugService,
  getProductById as getProductByIdService,
  createProduct as createProductService,
  updateProduct as updateProductService,
  updateProductStatus as updateProductStatusService,
  deleteProduct as deleteProductService,
  getProductImageCompletionReport as getProductImageCompletionReportService,
  getPublicProductFacets as getPublicProductFacetsService,
  getPublicBestSellingProducts as getPublicBestSellingProductsService,
} from "../service/productService.js";

/*
|--------------------------------------------------------------------------
| 1. Get Public Products
|--------------------------------------------------------------------------
| GET /api/v1/products
|
| Returns active products belonging to active categories.
|--------------------------------------------------------------------------
*/

export const getPublicProducts = async (req, res, next) => {
  try {
    const {
      page,
      limit,
      search,
      category,
      categories,
      collectionSearch,
      material,
      occasion,
      excludeMaterial,
      collectionMaterial,
      collectionExcludeMaterial,
      color,
      minPrice,
      maxPrice,
      available,
      isFeatured,
      tags,
      sort,
    } = req.query;

    const result = await listProductsService({
      page,
      limit,
      search,
      category,
      categories,
      collectionSearch,
      material,
      occasion,
      excludeMaterial,
      collectionMaterial,
      collectionExcludeMaterial,
      color,
      minPrice,
      maxPrice,
      available,
      isFeatured,
      tags,
      sort,
    });

    return res.status(200).json({
      success: true,
      message: "Products retrieved successfully.",
      ...result,
    });
  } catch (error) {
    return next(error);
  }
};

export const getPublicProductFacets = async (req, res, next) => {
  try {
    const facets = await getPublicProductFacetsService();
    return res.status(200).json({
      success: true,
      message: "Product filters retrieved successfully.",
      facets,
    });
  } catch (error) {
    return next(error);
  }
};

export const getPublicBestSellingProducts = async (req, res, next) => {
  try {
    const products = await getPublicBestSellingProductsService({
      limit: req.query.limit ?? 8,
    });
    return res.status(200).json({
      success: true,
      message: "Best-selling products retrieved successfully.",
      products,
    });
  } catch (error) {
    return next(error);
  }
};

/*
|--------------------------------------------------------------------------
| 2. Get Public Product Details
|--------------------------------------------------------------------------
| GET /api/v1/products/:slug
|
| Only active products are returned.
|--------------------------------------------------------------------------
*/

export const getPublicProductBySlug = async (
  req,
  res,
  next
) => {
  try {
    const product = await getProductBySlugService(
      req.params.slug
    );

    return res.status(200).json({
      success: true,
      message: "Product retrieved successfully.",
      product,
    });
  } catch (error) {
    return next(error);
  }
};

/*
|--------------------------------------------------------------------------
| 3. Get Products For Admin
|--------------------------------------------------------------------------
| GET /api/v1/admin/products
|
| Admin can view draft, active and archived products.
|--------------------------------------------------------------------------
*/

export const getAdminProducts = async (req, res, next) => {
  try {
    const {
      page,
      limit,
      search,
      category,
      material,
      color,
      minPrice,
      maxPrice,
      isFeatured,
      tags,
      sort,
      status,
    } = req.query;

    const result = await listProductsService({
      page,
      limit,
      search,
      category,
      material,
      color,
      minPrice,
      maxPrice,
      isFeatured,
      tags,
      sort,
      status,
      includeNonActive: true,
    });

    return res.status(200).json({
      success: true,
      message: "Admin products retrieved successfully.",
      ...result,
    });
  } catch (error) {
    return next(error);
  }
};

export const getProductImageCompletionReport = async (req, res, next) => {
  try {
    const report = await getProductImageCompletionReportService({
      page: req.query.page,
      limit: req.query.limit,
    });
    return res.status(200).json({
      success: true,
      message: "Product image completion report retrieved successfully.",
      ...report,
    });
  } catch (error) {
    return next(error);
  }
};

/*
|--------------------------------------------------------------------------
| 4. Get Product By ID For Admin
|--------------------------------------------------------------------------
| GET /api/v1/admin/products/:productId
|--------------------------------------------------------------------------
*/

export const getAdminProductById = async (
  req,
  res,
  next
) => {
  try {
    const product = await getProductByIdService(
      req.params.productId
    );

    return res.status(200).json({
      success: true,
      message: "Product retrieved successfully.",
      product,
    });
  } catch (error) {
    return next(error);
  }
};

/*
|--------------------------------------------------------------------------
| 5. Create Product
|--------------------------------------------------------------------------
| POST /api/v1/admin/products
|--------------------------------------------------------------------------
*/

export const createProduct = async (req, res, next) => {
  try {
    if (!req.admin?.adminId) {
      return res.status(401).json({
        success: false,
        message: "Admin authentication required.",
      });
    }

    const product = await createProductService(
      req.validatedBody ?? req.body,
      req.admin.adminId
    );

    return res.status(201).json({
      success: true,
      message: "Product created successfully.",
      product,
    });
  } catch (error) {
    return next(error);
  }
};

/*
|--------------------------------------------------------------------------
| 6. Update Product
|--------------------------------------------------------------------------
| PATCH /api/v1/admin/products/:productId
|--------------------------------------------------------------------------
*/

export const updateProduct = async (req, res, next) => {
  try {
    if (!req.admin?.adminId) {
      return res.status(401).json({
        success: false,
        message: "Admin authentication required.",
      });
    }

    const product = await updateProductService(
      req.params.productId,
      req.validatedBody ?? req.body,
      req.admin.adminId
    );

    return res.status(200).json({
      success: true,
      message: "Product updated successfully.",
      product,
    });
  } catch (error) {
    return next(error);
  }
};

/*
|--------------------------------------------------------------------------
| 7. Update Product Status
|--------------------------------------------------------------------------
| PATCH /api/v1/admin/products/:productId/status
|--------------------------------------------------------------------------
*/

export const updateProductStatus = async (
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

    const body = req.validatedBody ?? req.body;

    const product = await updateProductStatusService(
      req.params.productId,
      body.status,
      req.admin.adminId
    );

    return res.status(200).json({
      success: true,
      message: `Product status updated to "${product.status}".`,
      product,
    });
  } catch (error) {
    return next(error);
  }
};

/*
|--------------------------------------------------------------------------
| 8. Archive Product
|--------------------------------------------------------------------------
| DELETE /api/v1/admin/products/:productId
|
| This operation archives the product instead of permanently
| deleting a record that may be referenced by orders or inventory.
|--------------------------------------------------------------------------
*/

export const deleteProduct = async (req, res, next) => {
  try {
    if (!req.admin?.adminId) {
      return res.status(401).json({
        success: false,
        message: "Admin authentication required.",
      });
    }

    const result = await deleteProductService(
      req.params.productId,
      req.admin.adminId
    );

    return res.status(200).json({
      success: true,
      message: result.message,
      product: {
        id: result.id,
        status: result.status,
      },
    });
  } catch (error) {
    return next(error);
  }
};
