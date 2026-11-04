import mongoose from "mongoose";

import Category from "../models/Category.js";
import Product from "../models/Product.js";

/*
|--------------------------------------------------------------------------
| Common Helpers
|--------------------------------------------------------------------------
*/

const createError = (message, statusCode) => {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
};

const isValidObjectId = (id) => {
  return (
    typeof id === "string" &&
    /^[a-f\d]{24}$/i.test(id)
  );
};

const escapeRegex = (value) => {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
};

const handleDatabaseError = (error) => {
  if (error?.code === 11000) {
    throw createError(
      "A category with this slug already exists.",
      409
    );
  }

  if (error?.name === "ValidationError") {
    error.statusCode = 400;
  }

  throw error;
};

/*
|--------------------------------------------------------------------------
| Parent Category Validation
|--------------------------------------------------------------------------
| - Parent must exist.
| - Parent must be active.
| - A category cannot become its own parent.
| - Circular category hierarchies are prevented.
*/

const validateParentCategory = async (
  parentCategory,
  currentCategoryId = null
) => {
  if (parentCategory === undefined || parentCategory === null) {
    return;
  }

  if (!isValidObjectId(String(parentCategory))) {
    throw createError(
      "Invalid parent category ID.",
      400
    );
  }

  const currentId = currentCategoryId
    ? String(currentCategoryId)
    : null;

  const visited = new Set();
  let current = await Category.findById(parentCategory)
    .select("_id parentCategory isActive");

  if (!current) {
    throw createError(
      "Parent category not found.",
      404
    );
  }

  if (!current.isActive) {
    throw createError(
      "Parent category must be active.",
      400
    );
  }

  while (current) {
    const ancestorId = String(current._id);

    if (currentId && ancestorId === currentId) {
      throw createError(
        "Circular category hierarchy is not allowed.",
        400
      );
    }

    if (visited.has(ancestorId)) {
      throw createError(
        "An existing circular category hierarchy was detected.",
        409
      );
    }

    visited.add(ancestorId);

    if (!current.parentCategory) {
      break;
    }

    current = await Category.findById(
      current.parentCategory
    ).select("_id parentCategory isActive");

    if (!current) {
      break;
    }
  }
};

/*
|--------------------------------------------------------------------------
| 1. List Categories
|--------------------------------------------------------------------------
| Public usage:
|   listCategories()
|
| Admin usage:
|   listCategories({ includeInactive: true })
|
*/

export const listCategories = async ({
  page = 1,
  limit = 20,
  search = "",
  includeInactive = false,
  parentCategory,
  isFeatured,
} = {}) => {
  const currentPage = Math.max(
    1,
    Math.floor(Number(page) || 1)
  );

  const pageSize = Math.min(
    100,
    Math.max(1, Math.floor(Number(limit) || 20))
  );

  const filter = {};

  // Public listing returns active categories only.
  if (!includeInactive) {
    filter.isActive = true;
  }

  // Filter by parent category, or "root" for top-level categories.
  if (parentCategory !== undefined) {
    if (
      parentCategory === "root" ||
      parentCategory === "null"
    ) {
      filter.parentCategory = null;
    } else {
      if (!isValidObjectId(String(parentCategory))) {
        throw createError(
          "Invalid parent category ID.",
          400
        );
      }

      filter.parentCategory = parentCategory;
    }
  }

  if (typeof isFeatured === "boolean") {
    filter.isFeatured = isFeatured;
  }

  if (typeof search === "string" && search.trim()) {
    const searchPattern = new RegExp(
      escapeRegex(search.trim()),
      "i"
    );

    filter.$or = [
      { name: searchPattern },
      { description: searchPattern },
      { slug: searchPattern },
    ];
  }

  const skip = (currentPage - 1) * pageSize;

  const [categories, total] = await Promise.all([
    Category.find(filter)
      .populate("parentCategory", "name slug")
      .sort({ sortOrder: 1, name: 1 })
      .skip(skip)
      .limit(pageSize)
      .lean(),

    Category.countDocuments(filter),
  ]);

  return {
    categories,
    pagination: {
      page: currentPage,
      limit: pageSize,
      total,
      totalPages: Math.ceil(total / pageSize),
    },
  };
};

/*
|--------------------------------------------------------------------------
| 2. Get Category by Slug
|--------------------------------------------------------------------------
| Public category details.
|
*/

export const getCategoryBySlug = async (
  slug,
  { includeInactive = false } = {}
) => {
  const normalizedSlug = String(slug || "")
    .trim()
    .toLowerCase();

  if (!normalizedSlug) {
    throw createError(
      "Category slug is required.",
      400
    );
  }

  const filter = {
    slug: normalizedSlug,
  };

  if (!includeInactive) {
    filter.isActive = true;
  }

  const category = await Category.findOne(filter)
    .populate("parentCategory", "name slug")
    .lean();

  if (!category) {
    throw createError(
      "Category not found.",
      404
    );
  }

  return category;
};

/*
|--------------------------------------------------------------------------
| 3. Get Category by ID
|--------------------------------------------------------------------------
| Primarily for admin operations.
|
*/

export const getCategoryById = async (categoryId) => {
  if (!isValidObjectId(String(categoryId))) {
    throw createError(
      "Invalid category ID.",
      400
    );
  }

  const category = await Category.findById(categoryId)
    .populate("parentCategory", "name slug")
    .lean();

  if (!category) {
    throw createError(
      "Category not found.",
      404
    );
  }

  return category;
};

/*
|--------------------------------------------------------------------------
| 4. Create Category
|--------------------------------------------------------------------------
*/

export const createCategory = async (data) => {
  try {
    await validateParentCategory(data.parentCategory);

    const category = await Category.create(data);

    return category;
  } catch (error) {
    handleDatabaseError(error);
  }
};

/*
|--------------------------------------------------------------------------
| 5. Update Category
|--------------------------------------------------------------------------
*/

export const updateCategory = async (
  categoryId,
  data
) => {
  if (!isValidObjectId(String(categoryId))) {
    throw createError(
      "Invalid category ID.",
      400
    );
  }

  try {
    const category = await Category.findById(categoryId);

    if (!category) {
      throw createError(
        "Category not found.",
        404
      );
    }

    // Validate the parent only when the request changes it.
    if (
      Object.prototype.hasOwnProperty.call(
        data,
        "parentCategory"
      )
    ) {
      await validateParentCategory(
        data.parentCategory,
        String(category._id)
      );
    }

    Object.assign(category, data);

    await category.save();

    return category;
  } catch (error) {
    handleDatabaseError(error);
  }
};

/*
|--------------------------------------------------------------------------
| 6. Activate / Deactivate Category
|--------------------------------------------------------------------------
*/

export const updateCategoryStatus = async (
  categoryId,
  isActive
) => {
  if (!isValidObjectId(String(categoryId))) {
    throw createError(
      "Invalid category ID.",
      400
    );
  }

  if (typeof isActive !== "boolean") {
    throw createError(
      "isActive must be a boolean.",
      400
    );
  }

  const category = await Category.findById(categoryId);

  if (!category) {
    throw createError(
      "Category not found.",
      404
    );
  }

  // A child category cannot be reactivated under an inactive parent.
  if (isActive && category.parentCategory) {
    const parent = await Category.findById(
      category.parentCategory
    ).select("isActive");

    if (!parent || !parent.isActive) {
      throw createError(
        "Activate the parent category before activating this category.",
        400
      );
    }
  }

  // Prevent an active child from being left under an inactive parent.
  if (!isActive) {
    const activeChild = await Category.exists({
      parentCategory: category._id,
      isActive: true,
    });

    if (activeChild) {
      throw createError(
        "Deactivate child categories before deactivating this category.",
        409
      );
    }
  }

  category.isActive = isActive;

  await category.save();

  return category;
};

/*
|--------------------------------------------------------------------------
| 7. Delete Category
|--------------------------------------------------------------------------
| Hard deletion is blocked while products or child categories
| reference this category.
|
*/

export const deleteCategory = async (categoryId) => {
  if (!isValidObjectId(String(categoryId))) {
    throw createError(
      "Invalid category ID.",
      400
    );
  }

  const category = await Category.findById(categoryId);

  if (!category) {
    throw createError(
      "Category not found.",
      404
    );
  }

  const [productExists, childCategoryExists] =
    await Promise.all([
      Product.exists({
        category: category._id,
      }),

      Category.exists({
        parentCategory: category._id,
      }),
    ]);

  if (productExists) {
    throw createError(
      "Cannot delete this category because products are assigned to it. Deactivate it instead.",
      409
    );
  }

  if (childCategoryExists) {
    throw createError(
      "Cannot delete this category while child categories reference it.",
      409
    );
  }

  await Category.findByIdAndDelete(category._id);

  return {
    id: String(category._id),
    message: "Category deleted successfully.",
  };
};