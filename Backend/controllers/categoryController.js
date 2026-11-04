import {
  listCategories as listCategoriesService,
  getCategoryBySlug as getCategoryBySlugService,
  getCategoryById as getCategoryByIdService,
  createCategory as createCategoryService,
  updateCategory as updateCategoryService,
  updateCategoryStatus as updateCategoryStatusService,
  deleteCategory as deleteCategoryService,
} from "../service/categoryService.js";

/*
|--------------------------------------------------------------------------
| Helper: Parse Boolean Query Parameters
|--------------------------------------------------------------------------
*/

const parseBooleanQuery = (value, fieldName) => {
  if (value === undefined) {
    return undefined;
  }

  if (value === "true") {
    return true;
  }

  if (value === "false") {
    return false;
  }

  const error = new Error(
    `${fieldName} must be true or false.`
  );

  error.statusCode = 400;

  throw error;
};

/*
|--------------------------------------------------------------------------
| 1. Get Public Categories
|--------------------------------------------------------------------------
| GET /api/v1/categories
|
| Returns active categories only.
|
*/

export const getPublicCategories = async (
  req,
  res,
  next
) => {
  try {
    const isFeatured = parseBooleanQuery(
      req.query.isFeatured,
      "isFeatured"
    );

    const result = await listCategoriesService({
      page: req.query.page,
      limit: req.query.limit,
      search: req.query.search,
      parentCategory: req.query.parentCategory,
      isFeatured,
    });

    return res.status(200).json({
      success: true,
      message: "Categories retrieved successfully.",
      ...result,
    });
  } catch (error) {
    return next(error);
  }
};

/*
|--------------------------------------------------------------------------
| 2. Get Public Category Details
|--------------------------------------------------------------------------
| GET /api/v1/categories/:slug
|
| Only active categories are returned.
|
*/

export const getPublicCategoryBySlug = async (
  req,
  res,
  next
) => {
  try {
    const category = await getCategoryBySlugService(
      req.params.slug
    );

    return res.status(200).json({
      success: true,
      message: "Category retrieved successfully.",
      category,
    });
  } catch (error) {
    return next(error);
  }
};

/*
|--------------------------------------------------------------------------
| 3. Get All Categories For Admin
|--------------------------------------------------------------------------
| GET /api/v1/admin/categories
|
| Includes active and inactive categories.
| Route must be protected by admin authentication
| and the categories:read permission.
|
*/

export const getAdminCategories = async (
  req,
  res,
  next
) => {
  try {
    const isFeatured = parseBooleanQuery(
      req.query.isFeatured,
      "isFeatured"
    );

    const result = await listCategoriesService({
      page: req.query.page,
      limit: req.query.limit,
      search: req.query.search,
      parentCategory: req.query.parentCategory,
      isFeatured,
      includeInactive: true,
    });

    return res.status(200).json({
      success: true,
      message: "Admin categories retrieved successfully.",
      ...result,
    });
  } catch (error) {
    return next(error);
  }
};

/*
|--------------------------------------------------------------------------
| 4. Get Category By ID For Admin
|--------------------------------------------------------------------------
| GET /api/v1/admin/categories/:categoryId
|
*/

export const getAdminCategoryById = async (
  req,
  res,
  next
) => {
  try {
    const category = await getCategoryByIdService(
      req.params.categoryId
    );

    return res.status(200).json({
      success: true,
      message: "Category retrieved successfully.",
      category,
    });
  } catch (error) {
    return next(error);
  }
};

/*
|--------------------------------------------------------------------------
| 5. Create Category
|--------------------------------------------------------------------------
| POST /api/v1/admin/categories
|
*/

export const createCategory = async (
  req,
  res,
  next
) => {
  try {
    const category = await createCategoryService(
      req.validatedBody ?? req.body
    );

    return res.status(201).json({
      success: true,
      message: "Category created successfully.",
      category,
    });
  } catch (error) {
    return next(error);
  }
};

/*
|--------------------------------------------------------------------------
| 6. Update Category
|--------------------------------------------------------------------------
| PATCH /api/v1/admin/categories/:categoryId
|
*/

export const updateCategory = async (
  req,
  res,
  next
) => {
  try {
    const category = await updateCategoryService(
      req.params.categoryId,
      req.validatedBody ?? req.body
    );

    return res.status(200).json({
      success: true,
      message: "Category updated successfully.",
      category,
    });
  } catch (error) {
    return next(error);
  }
};

/*
|--------------------------------------------------------------------------
| 7. Activate / Deactivate Category
|--------------------------------------------------------------------------
| PATCH /api/v1/admin/categories/:categoryId/status
|
*/

export const updateCategoryStatus = async (
  req,
  res,
  next
) => {
  try {
    const body = req.validatedBody ?? req.body;

    const category = await updateCategoryStatusService(
      req.params.categoryId,
      body.isActive
    );

    return res.status(200).json({
      success: true,
      message: category.isActive
        ? "Category activated successfully."
        : "Category deactivated successfully.",
      category,
    });
  } catch (error) {
    return next(error);
  }
};

/*
|--------------------------------------------------------------------------
| 8. Delete Category
|--------------------------------------------------------------------------
| DELETE /api/v1/admin/categories/:categoryId
|
*/

export const deleteCategory = async (
  req,
  res,
  next
) => {
  try {
    const result = await deleteCategoryService(
      req.params.categoryId
    );

    return res.status(200).json({
      success: true,
      message: result.message,
      categoryId: result.id,
    });
  } catch (error) {
    return next(error);
  }
};