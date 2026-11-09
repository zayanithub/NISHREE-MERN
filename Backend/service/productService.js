import Product from "../models/Product.js";
import Category from "../models/Category.js";
import ProductImage from "../models/ProductImage.js";
import ProductVariant from "../models/ProductVariant.js";
import Inventory from "../models/Inventory.js";
import Order from "../models/Order.js";
import { getProductReviewSummaries } from "./reviewService.js";
import { eligibleSalesMatch } from "./salesPolicy.js";

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

const handleProductError = (error) => {
  if (error.statusCode) {
    throw error;
  }

  if (error.code === 11000) {
    const duplicateField = Object.keys(
      error.keyPattern || {}
    )[0];

    if (duplicateField === "sku") {
      throw createError(
        "A product with this SKU already exists.",
        409
      );
    }

    if (duplicateField === "slug") {
      throw createError(
        "A product with this slug already exists.",
        409
      );
    }

    throw createError(
      "A product with these unique details already exists.",
      409
    );
  }

  if (error.name === "ValidationError") {
    error.statusCode = 400;
  }

  throw error;
};

/*
|--------------------------------------------------------------------------
| Category Helpers
|--------------------------------------------------------------------------
*/

const findCategory = async (
  categoryId,
  { requireActive = true } = {}
) => {
  if (!isValidObjectId(String(categoryId))) {
    throw createError("Invalid category ID.", 400);
  }

  const filter = { _id: categoryId };

  if (requireActive) {
    filter.isActive = true;
  }

  const category = await Category.findOne(filter)
    .select("_id name slug isActive");

  if (!category) {
    throw createError(
      requireActive
        ? "Active category not found."
        : "Category not found.",
      404
    );
  }

  return category;
};

/*
|--------------------------------------------------------------------------
| Query Helpers
|--------------------------------------------------------------------------
*/

const parseOptionalPrice = (value, fieldName) => {
  if (value === undefined || value === null || value === "") {
    return undefined;
  }

  const parsed = Number(value);

  if (!Number.isFinite(parsed) || parsed < 0) {
    throw createError(
      `${fieldName} must be a valid non-negative number.`,
      400
    );
  }

  return parsed;
};

const parseOptionalBoolean = (value, fieldName) => {
  if (value === undefined || value === null || value === "") {
    return undefined;
  }

  if (value === true || value === "true") {
    return true;
  }

  if (value === false || value === "false") {
    return false;
  }

  throw createError(
    `${fieldName} must be true or false.`,
    400
  );
};

const parsePagination = (page, limit) => {
  const parsedPage = Number(page ?? 1);
  const parsedLimit = Number(limit ?? 20);

  if (!Number.isInteger(parsedPage) || parsedPage < 1) {
    throw createError(
      "Page must be a positive integer.",
      400
    );
  }

  if (
    !Number.isInteger(parsedLimit) ||
    parsedLimit < 1 ||
    parsedLimit > 100
  ) {
    throw createError(
      "Limit must be an integer between 1 and 100.",
      400
    );
  }

  return {
    page: parsedPage,
    limit: parsedLimit,
  };
};

const productSortOptions = {
  newest: { createdAt: -1 },
  oldest: { createdAt: 1 },
  "name-asc": { name: 1 },
  "name-desc": { name: -1 },
  featured: { isFeatured: -1, createdAt: -1 },
};

const getAvailableProductIds = async (productIds) => {
  if (!productIds.length) return [];

  const activeVariants = await ProductVariant.find({
    product: { $in: productIds },
    isActive: true,
  })
    .select("_id product")
    .lean();
  const activeVariantIds = activeVariants.map((variant) => variant._id);
  const productsWithVariants = activeVariants.map((variant) => variant.product);

  const stockedInventory = await Inventory.find({
    product: { $in: productIds },
    $expr: { $gt: ["$quantity", "$reservedQuantity"] },
    $or: [
      {
        inventoryType: "product",
        product: { $nin: productsWithVariants },
      },
      {
        inventoryType: "variant",
        variant: { $in: activeVariantIds },
      },
    ],
  })
    .select("product")
    .lean();

  return [...new Map(
    stockedInventory.map((item) => [String(item.product), item.product])
  ).values()];
};

/*
|--------------------------------------------------------------------------
| Public Product Detail Helpers
|--------------------------------------------------------------------------
*/

const getProductGallery = async (productId) => {
  const images = await ProductImage.find({
    product: productId,
  })
    .sort({
      sortOrder: 1,
      createdAt: 1,
    })
    .select(
      "_id url publicId altText sortOrder isPrimary"
    )
    .lean();

  if (images.length) return images;

  const product = await Product.findById(productId)
    .select("primaryImage imageAltText name")
    .lean();

  if (!product?.primaryImage?.url) return [];
  return [{
    _id: null,
    url: product.primaryImage.url,
    publicId: product.primaryImage.publicId || "",
    altText: product.imageAltText || product.name,
    sortOrder: 0,
    isPrimary: true,
    isLegacy: true,
  }];
};

const getActiveProductVariants = async (productId) => {
  const variants = await ProductVariant.find({
    product: productId,
    isActive: true,
  })
    .sort({
      createdAt: 1,
      _id: 1,
    })
    .select(
      "_id sku name color colorCode blouseOption priceAdjustment image isActive"
    )
    .lean();

  return variants.map((variant) => {
    const priceAdjustment = Number(
      variant.priceAdjustment ?? 0
    );

    return {
      ...variant,
      priceAdjustment,
    };
  });
};

const withAvailability = async (products) => {
  if (!products.length) return products;
  const productIds = products.map((product) => product._id);
  const activeVariants = await ProductVariant.find({
    product: { $in: productIds },
    isActive: true,
  }).select("_id product").lean();
  const variantsByProduct = new Map();
  for (const variant of activeVariants) {
    const key = String(variant.product);
    if (!variantsByProduct.has(key)) variantsByProduct.set(key, new Set());
    variantsByProduct.get(key).add(String(variant._id));
  }
  const inventory = await Inventory.find({ product: { $in: productIds } })
    .select("product variant inventoryType quantity reservedQuantity")
    .lean();
  const quantityByProduct = new Map();
  for (const item of inventory) {
    const key = String(item.product);
    const activeVariantIds = variantsByProduct.get(key);
    const isRelevant = activeVariantIds?.size
      ? item.inventoryType === "variant" && activeVariantIds.has(String(item.variant))
      : item.inventoryType === "product";
    if (!isRelevant) continue;
    quantityByProduct.set(
      key,
      (quantityByProduct.get(key) || 0) + Math.max(0, item.quantity - item.reservedQuantity),
    );
  }
  return products.map((product) => ({
    ...product,
    availableQuantity: quantityByProduct.get(String(product._id)) || 0,
  }));
};

/*
|--------------------------------------------------------------------------
| 1. List Products
|--------------------------------------------------------------------------
| Public:
|   listProducts()
|
| Admin:
|   listProducts({ includeNonActive: true })
|--------------------------------------------------------------------------
*/

export const listProducts = async ({
  page = 1,
  limit = 20,
  search = "",
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
  sort = "newest",
  status,
  includeNonActive = false,
} = {}) => {
  const pagination = parsePagination(page, limit);

  const minimumPrice = parseOptionalPrice(
    minPrice,
    "minPrice"
  );

  const maximumPrice = parseOptionalPrice(
    maxPrice,
    "maxPrice"
  );

  const featuredFilter = parseOptionalBoolean(
    isFeatured,
    "isFeatured"
  );

  const availabilityFilter = parseOptionalBoolean(
    available,
    "available"
  );

  if (
    minimumPrice !== undefined &&
    maximumPrice !== undefined &&
    minimumPrice > maximumPrice
  ) {
    throw createError(
      "minPrice cannot exceed maxPrice.",
      400
    );
  }

  const filter = {};

  if (includeNonActive) {
    if (status !== undefined && status !== "all") {
      if (!["draft", "active", "archived"].includes(status)) {
        throw createError(
          "Invalid product status filter.",
          400
        );
      }

      filter.status = status;
    }
  } else {
    filter.status = "active";
  }

  if (!includeNonActive) {
    const activeCategoryIds = await Category.distinct(
      "_id",
      { isActive: true }
    );

    filter.category = {
      $in: activeCategoryIds,
    };
  }

  if (categories !== undefined && categories !== "") {
    const categorySlugs = [...new Set(
      String(categories)
        .split(",")
        .map((slug) => slug.trim().toLowerCase())
        .filter(Boolean)
    )];
    if (!categorySlugs.length) {
      throw createError("Category not found.", 404);
    }

    const matchedCategories = await Category.find({
      slug: { $in: categorySlugs },
      ...(includeNonActive ? {} : { isActive: true }),
    }).select("_id slug").lean();

    if (matchedCategories.length !== categorySlugs.length) {
      throw createError("Category not found.", 404);
    }

    filter.category = { $in: matchedCategories.map((item) => item._id) };
  } else if (category !== undefined && category !== "") {
    let matchedCategory;

    if (isValidObjectId(String(category))) {
      matchedCategory = await Category.findOne({
        _id: category,
        ...(includeNonActive ? {} : { isActive: true }),
      }).select("_id");
    } else {
      matchedCategory = await Category.findOne({
        slug: String(category).trim().toLowerCase(),
        ...(includeNonActive ? {} : { isActive: true }),
      }).select("_id");
    }

    if (!matchedCategory) {
      throw createError("Category not found.", 404);
    }

    filter.category = matchedCategory._id;
  }

  const searchConditions = [search, collectionSearch]
    .filter((value) => typeof value === "string" && value.trim())
    .map((value) => {
      const searchRegex = new RegExp(escapeRegex(value.trim()), "i");
      return {
        $or: [
          { name: searchRegex },
          { description: searchRegex },
          { shortDescription: searchRegex },
          { tags: searchRegex },
        ],
      };
    });

  const queryConditions = [...searchConditions];
  for (const includedMaterial of [material, collectionMaterial]) {
    if (typeof includedMaterial === "string" && includedMaterial.trim()) {
      queryConditions.push({
        material: new RegExp(escapeRegex(includedMaterial.trim()), "i"),
      });
    }
  }
  for (const excludedMaterial of [excludeMaterial, collectionExcludeMaterial]) {
    if (typeof excludedMaterial === "string" && excludedMaterial.trim()) {
      queryConditions.push({
        material: { $not: new RegExp(escapeRegex(excludedMaterial.trim()), "i") },
      });
    }
  }
  if (queryConditions.length) filter.$and = queryConditions;

  if (typeof color === "string" && color.trim()) {
    filter.color = new RegExp(
      escapeRegex(color.trim()),
      "i"
    );
  }

  if (typeof occasion === "string" && occasion.trim()) {
    filter.occasion = new RegExp(
      escapeRegex(occasion.trim()),
      "i"
    );
  }

  if (featuredFilter !== undefined) {
    filter.isFeatured = featuredFilter;
  }

  if (tags !== undefined && tags !== "") {
    const tagList = Array.isArray(tags)
      ? tags
      : String(tags).split(",");

    const normalizedTags = tagList
      .map((tag) => String(tag).trim().toLowerCase())
      .filter(Boolean);

    if (normalizedTags.length > 0) {
      filter.tags = {
        $in: normalizedTags,
      };
    }
  }

  const priceExpression = [];

  if (minimumPrice !== undefined) {
    priceExpression.push({
      $gte: [
        { $ifNull: ["$salePrice", "$basePrice"] },
        minimumPrice,
      ],
    });
  }

  if (maximumPrice !== undefined) {
    priceExpression.push({
      $lte: [
        { $ifNull: ["$salePrice", "$basePrice"] },
        maximumPrice,
      ],
    });
  }

  if (priceExpression.length > 0) {
    filter.$expr = {
      $and: priceExpression,
    };
  }

  if (availabilityFilter !== undefined) {
    const candidateProductIds = await Product.distinct("_id", filter);
    const availableProductIds = await getAvailableProductIds(candidateProductIds);
    filter._id = availabilityFilter
      ? { $in: availableProductIds }
      : { $nin: availableProductIds };
  }

  const skip =
    (pagination.page - 1) * pagination.limit;

  const sortOrder =
    productSortOptions[sort] ||
    productSortOptions.newest;

  const productsRequest = sort === "price-asc" || sort === "price-desc"
    ? Product.aggregate([
      { $match: filter },
      {
        $addFields: {
          sortPrice: { $ifNull: ["$salePrice", "$basePrice"] },
        },
      },
      { $sort: { sortPrice: sort === "price-asc" ? 1 : -1, _id: 1 } },
      { $skip: skip },
      { $limit: pagination.limit },
      { $project: { sortPrice: 0 } },
    ]).then((products) => Product.populate(products, {
      path: "category",
      select: "name slug isActive",
    }))
    : Product.find(filter)
      .populate("category", "name slug isActive")
      .sort(sortOrder)
      .skip(skip)
      .limit(pagination.limit)
      .lean();

  const [products, total] = await Promise.all([
    productsRequest,
    Product.countDocuments(filter),
  ]);

  let productsWithAvailability = await withAvailability(products);
  if (includeNonActive && products.length) {
    const imageCounts = await ProductImage.aggregate([
      { $match: { product: { $in: products.map((product) => product._id) } } },
      { $group: { _id: "$product", count: { $sum: 1 } } },
    ]);
    const countByProduct = new Map(
      imageCounts.map((entry) => [String(entry._id), entry.count])
    );
    productsWithAvailability = productsWithAvailability.map((product) => ({
      ...product,
      imageCount: countByProduct.get(String(product._id)) ||
        (product.primaryImage?.url ? 1 : 0),
    }));
  }
  let productsWithReviewSummary = productsWithAvailability;

  if (!includeNonActive) {
    const summaries = await getProductReviewSummaries(
      products.map((product) => product._id)
    );

    productsWithReviewSummary = productsWithAvailability.map((product) => ({
      ...product,
      reviewSummary: summaries[String(product._id)] ?? {
        reviewCount: 0,
        averageRating: 0,
      },
    }));
  }

  return {
    products: productsWithReviewSummary,
    pagination: {
      page: pagination.page,
      limit: pagination.limit,
      total,
      totalPages: Math.ceil(
        total / pagination.limit
      ),
    },
  };
};

export const getPublicProductFacets = async () => {
  const activeCategoryIds = await Category.distinct("_id", { isActive: true });
  const [facets = {}] = await Product.aggregate([
    {
      $match: {
        status: "active",
        category: { $in: activeCategoryIds },
      },
    },
    {
      $facet: {
        attributes: [
          {
            $group: {
              _id: null,
              materials: { $addToSet: "$material" },
              occasions: { $addToSet: "$occasion" },
            },
          },
        ],
        prices: [
          {
            $match: {
              $expr: {
                $gt: [{ $ifNull: ["$salePrice", "$basePrice"] }, 0],
              },
            },
          },
          {
            $group: {
              _id: null,
              minimum: { $min: { $ifNull: ["$salePrice", "$basePrice"] } },
              maximum: { $max: { $ifNull: ["$salePrice", "$basePrice"] } },
            },
          },
        ],
      },
    },
  ]);

  const attributes = facets.attributes?.[0] ?? {};
  const prices = facets.prices?.[0] ?? {};
  const normalize = (values) => [...new Set(
    (Array.isArray(values) ? values.flat(Infinity) : [])
      .filter((value) => typeof value === "string")
      .map((value) => value.trim())
      .filter(Boolean)
  )].sort((left, right) => left.localeCompare(right));

  return {
    materials: normalize(attributes.materials),
    occasions: normalize(attributes.occasions),
    priceRange: {
      minimum: Number.isFinite(prices.minimum) ? prices.minimum : null,
      maximum: Number.isFinite(prices.maximum) ? prices.maximum : null,
    },
  };
};

export const getPublicBestSellingProducts = async ({ limit = 8 } = {}) => {
  const pagination = parsePagination(1, limit);
  const activeCategoryIds = await Category.distinct("_id", { isActive: true });
  const activeProductIds = await Product.distinct("_id", {
    status: "active",
    category: { $in: activeCategoryIds },
  });

  if (!activeProductIds.length) return [];

  const ranked = await Order.aggregate([
    { $match: eligibleSalesMatch() },
    { $unwind: "$items" },
    { $match: { "items.product": { $in: activeProductIds } } },
    {
      $group: {
        _id: "$items.product",
        unitsSold: { $sum: "$items.quantity" },
        lastSoldAt: { $max: "$createdAt" },
      },
    },
    { $sort: { unitsSold: -1, lastSoldAt: -1, _id: 1 } },
    { $limit: pagination.limit },
  ]);

  if (!ranked.length) return [];

  const rankedIds = ranked.map((item) => item._id);
  const products = await Product.find({
    _id: { $in: rankedIds },
    status: "active",
    category: { $in: activeCategoryIds },
  })
    .populate("category", "name slug isActive")
    .lean();
  const productById = new Map(products.map((product) => [String(product._id), product]));
  const orderedProducts = ranked
    .map((item) => productById.get(String(item._id)))
    .filter(Boolean);
  const availableProducts = await withAvailability(orderedProducts);
  const reviewSummaries = await getProductReviewSummaries(
    availableProducts.map((product) => product._id)
  );

  return availableProducts.map((product) => ({
    ...product,
    reviewSummary: reviewSummaries[String(product._id)] ?? {
      reviewCount: 0,
      averageRating: 0,
    },
  }));
};

/*
|--------------------------------------------------------------------------
| 2. Get Public Product By Slug
|--------------------------------------------------------------------------
| GET /api/v1/products/:slug
|
| Returns:
| - Active product in active category
| - Product gallery images
| - Active variants only
| - Variant price adjustment
|--------------------------------------------------------------------------
*/

export const getProductBySlug = async (slug) => {
  const normalizedSlug = String(slug || "")
    .trim()
    .toLowerCase();

  if (!normalizedSlug) {
    throw createError(
      "Product slug is required.",
      400
    );
  }

  const product = await Product.findOne({
    slug: normalizedSlug,
    status: "active",
  })
    .populate("category", "name slug isActive")
    .lean();

  if (
    !product ||
    !product.category ||
    !product.category.isActive
  ) {
    throw createError("Product not found.", 404);
  }

  const [images, variants, summaries] = await Promise.all([
    getProductGallery(product._id),
    getActiveProductVariants(product._id),
    getProductReviewSummaries([product._id]),
  ]);

  const effectiveBasePrice =
    product.salePrice != null
      ? Number(product.salePrice)
      : Number(product.basePrice);

  const variantsWithFinalPrice = variants.map(
    (variant) => ({
      ...variant,
      finalPrice:
        effectiveBasePrice +
        Number(variant.priceAdjustment ?? 0),
    })
  );

  const [availableProduct] = await withAvailability([product]);

  return {
    ...availableProduct,
    images,
    variants: variantsWithFinalPrice,
    reviewSummary: summaries[String(product._id)] ?? {
      reviewCount: 0,
      averageRating: 0,
    },
  };
};

/*
|--------------------------------------------------------------------------
| 3. Get Product By ID
|--------------------------------------------------------------------------
| Admin use: drafts and archived products are visible.
|--------------------------------------------------------------------------
*/

export const getProductById = async (productId) => {
  if (!isValidObjectId(String(productId))) {
    throw createError("Invalid product ID.", 400);
  }

  const product = await Product.findById(productId)
    .populate("category", "name slug isActive")
    .lean();

  if (!product) {
    throw createError("Product not found.", 404);
  }

  const [images, variants] = await Promise.all([
    getProductGallery(product._id),
    ProductVariant.find({
    product: product._id,
    })
      .sort({
        isActive: -1,
        createdAt: 1,
        _id: 1,
      })
      .lean(),
  ]);

  const effectiveBasePrice =
    product.salePrice != null
      ? Number(product.salePrice)
      : Number(product.basePrice);

  return {
    ...product,
    images,
    variants: variants.map((variant) => ({
      ...variant,
      finalPrice:
        effectiveBasePrice +
        Number(variant.priceAdjustment ?? 0),
    })),
  };
};

export const getProductImageCompletionReport = async ({
  page = 1,
  limit = 100,
} = {}) => {
  const pagination = parsePagination(page, limit);
  const [result = { products: [], total: [] }] = await Product.aggregate([
    {
      $lookup: {
        from: ProductImage.collection.name,
        localField: "_id",
        foreignField: "product",
        as: "gallery",
      },
    },
    {
      $addFields: {
        imageCount: {
          $cond: [
            { $gt: [{ $size: "$gallery" }, 0] },
            { $size: "$gallery" },
            { $cond: [{ $ne: ["$primaryImage.url", ""] }, 1, 0] },
          ],
        },
        uniqueImageCount: {
          $size: {
            $setUnion: [
              { $map: { input: "$gallery", as: "image", in: "$$image.url" } },
              [],
            ],
          },
        },
        primaryImageCount: {
          $size: {
            $filter: {
              input: "$gallery",
              as: "image",
              cond: { $eq: ["$$image.isPrimary", true] },
            },
          },
        },
      },
    },
    {
      $addFields: {
        uniqueImageCount: {
          $cond: [
            { $gt: [{ $size: "$gallery" }, 0] },
            "$uniqueImageCount",
            "$imageCount",
          ],
        },
        primaryImageCount: {
          $cond: [
            { $gt: [{ $size: "$gallery" }, 0] },
            "$primaryImageCount",
            "$imageCount",
          ],
        },
      },
    },
    {
      $match: {
        $expr: {
          $or: [
            { $lt: ["$imageCount", 4] },
            { $gt: ["$imageCount", 5] },
            { $ne: ["$imageCount", "$uniqueImageCount"] },
            { $ne: ["$primaryImageCount", 1] },
          ],
        },
      },
    },
    {
      $facet: {
        products: [
          { $sort: { name: 1, _id: 1 } },
          { $skip: (pagination.page - 1) * pagination.limit },
          { $limit: pagination.limit },
          {
            $project: {
              _id: 1,
              name: 1,
              slug: 1,
              sku: 1,
              status: 1,
              imageCount: 1,
              uniqueImageCount: 1,
              primaryImageCount: 1,
              missingImages: { $max: [0, { $subtract: [4, "$imageCount"] }] },
            },
          },
        ],
        total: [{ $count: "count" }],
      },
    },
  ]);
  const total = result.total[0]?.count || 0;

  return {
    products: result.products,
    pagination: {
      page: pagination.page,
      limit: pagination.limit,
      total,
      totalPages: Math.ceil(total / pagination.limit),
    },
  };
};

const assertProductCanBePublished = async (productId) => {
  const [images, product] = await Promise.all([
    ProductImage.find({ product: productId })
      .select("url isPrimary")
      .lean(),
    Product.findById(productId).select("primaryImage.url").lean(),
  ]);
  const legacyImage = product?.primaryImage?.url;
  const imageUrls = images.length ? images.map((image) => image.url) : legacyImage ? [legacyImage] : [];
  const uniqueUrls = new Set(imageUrls);

  if (imageUrls.length < 4 || imageUrls.length > 5 || uniqueUrls.size !== imageUrls.length) {
    throw createError(
      "Add 4–5 unique product images before publishing this product.",
      400
    );
  }

  if (images.length && images.filter((image) => image.isPrimary).length !== 1) {
    throw createError(
      "Select exactly one primary product image before publishing.",
      400
    );
  }
};

/*
|--------------------------------------------------------------------------
| 4. Create Product
|--------------------------------------------------------------------------
*/

export const createProduct = async (data, adminId) => {
  try {
    if (!isValidObjectId(String(adminId))) {
      throw createError("Invalid admin ID.", 401);
    }

    if (data.category) {
      await findCategory(data.category);
    }

    const productId = new Product()._id.toString();
    const suffix = productId.slice(-8).toUpperCase();
    const name = String(data.name || "").trim() || "Untitled product";
    const basePrice = data.basePrice ?? data.salePrice ?? 0;
    const slugBase = String(data.slug || name)
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 200);

    if (
      data.salePrice != null &&
      data.salePrice > basePrice
    ) {
      throw createError(
        "Sale price cannot exceed base price.",
        400
      );
    }

    if (data.status === "active") {
      throw createError(
        "Create the product as a draft, upload 4–5 unique images, then publish it.",
        400
      );
    }

    const productData = {
      ...data,
      _id: productId,
      name,
      slug: String(data.slug || `${slugBase || "product"}-${suffix}`).trim().toLowerCase(),
      sku: String(data.sku || `NIS-${suffix}`).trim().toUpperCase(),
      description: String(data.description || "").trim(),
      basePrice,
      status: data.status,
      createdBy: adminId,
      updatedBy: adminId,
    };

    const product = await Product.create(productData);

    return product;
  } catch (error) {
    handleProductError(error);
  }
};

/*
|--------------------------------------------------------------------------
| 5. Update Product
|--------------------------------------------------------------------------
*/

export const updateProduct = async (
  productId,
  data,
  adminId
) => {
  if (!isValidObjectId(String(productId))) {
    throw createError("Invalid product ID.", 400);
  }

  if (!isValidObjectId(String(adminId))) {
    throw createError("Invalid admin ID.", 401);
  }

  try {
    const product = await Product.findById(productId);

    if (!product) {
      throw createError("Product not found.", 404);
    }

    if (
      Object.prototype.hasOwnProperty.call(
        data,
        "category"
      ) && data.category
    ) {
      await findCategory(data.category);
    }

    const finalBasePrice =
      data.basePrice !== undefined
        ? data.basePrice
        : product.basePrice;

    const finalSalePrice =
      Object.prototype.hasOwnProperty.call(
        data,
        "salePrice"
      )
        ? data.salePrice
        : product.salePrice;

    if (
      finalSalePrice != null &&
      finalSalePrice > finalBasePrice
    ) {
      throw createError(
        "Sale price cannot exceed base price. Update the sale price too.",
        400
      );
    }

    const updateData = { ...data };

    if (updateData.name !== undefined) {
      updateData.name = updateData.name.trim();
    }

    if (updateData.slug !== undefined) {
      updateData.slug = updateData.slug
        .trim()
        .toLowerCase();
    }

    if (updateData.sku !== undefined) {
      updateData.sku = updateData.sku
        .trim()
        .toUpperCase();
    }

    Object.assign(product, updateData);

    product.updatedBy = adminId;

    await product.save();

    return product;
  } catch (error) {
    handleProductError(error);
  }
};

/*
|--------------------------------------------------------------------------
| 6. Update Product Status
|--------------------------------------------------------------------------
*/

export const updateProductStatus = async (
  productId,
  status,
  adminId
) => {
  if (!isValidObjectId(String(productId))) {
    throw createError("Invalid product ID.", 400);
  }

  if (!isValidObjectId(String(adminId))) {
    throw createError("Invalid admin ID.", 401);
  }

  if (!["draft", "active", "archived"].includes(status)) {
    throw createError("Invalid product status.", 400);
  }

  const product = await Product.findById(productId);

  if (!product) {
    throw createError("Product not found.", 404);
  }

  if (status === "active") {
    await findCategory(String(product.category));
    if (product.status !== "active") {
      await assertProductCanBePublished(product._id);
    }
  }

  product.status = status;
  product.updatedBy = adminId;

  await product.save();

  return product;
};

/*
|--------------------------------------------------------------------------
| 7. Delete Product = Archive Product
|--------------------------------------------------------------------------
*/

export const deleteProduct = async (
  productId,
  adminId
) => {
  if (!isValidObjectId(String(productId))) {
    throw createError("Invalid product ID.", 400);
  }

  if (!isValidObjectId(String(adminId))) {
    throw createError("Invalid admin ID.", 401);
  }

  const product = await Product.findById(productId);

  if (!product) {
    throw createError("Product not found.", 404);
  }

  product.status = "archived";
  product.updatedBy = adminId;

  await product.save();

  return {
    id: String(product._id),
    status: product.status,
    message: "Product archived successfully.",
  };
};
