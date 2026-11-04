import Product from "../models/Product.js";
import ProductVariant from "../models/ProductVariant.js";

/*
|--------------------------------------------------------------------------
| Error Helper
|--------------------------------------------------------------------------
*/

const createError = (message, statusCode) => {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
};

/*
|--------------------------------------------------------------------------
| Constants
|--------------------------------------------------------------------------
*/

const ALLOWED_BLOUSE_OPTIONS = [
  "with_blouse",
  "without_blouse",
  "stitched_blouse",
];

const HEX_COLOR_REGEX =
  /^#([0-9A-Fa-f]{3}|[0-9A-Fa-f]{6})$/;

/*
|--------------------------------------------------------------------------
| Validation Helpers
|--------------------------------------------------------------------------
*/

const isValidObjectId = (id) => {
  return (
    typeof id === "string" &&
    /^[a-f\d]{24}$/i.test(id)
  );
};

const validateAdminId = (adminId) => {
  if (!isValidObjectId(String(adminId))) {
    throw createError(
      "A valid authenticated admin ID is required.",
      401
    );
  }
};

const validateProductId = (productId) => {
  if (!isValidObjectId(String(productId))) {
    throw createError(
      "Invalid product ID.",
      400
    );
  }
};

const validateVariantId = (variantId) => {
  if (!isValidObjectId(String(variantId))) {
    throw createError(
      "Invalid variant ID.",
      400
    );
  }
};

const validateVariantData = (
  data,
  { partial = false } = {}
) => {
  if (
    !data ||
    typeof data !== "object" ||
    Array.isArray(data)
  ) {
    throw createError(
      "Variant data must be a valid object.",
      400
    );
  }

  /*
  |--------------------------------------------------------------------------
  | SKU Validation
  |--------------------------------------------------------------------------
  */

  if (
    data.sku !== undefined &&
    (
      typeof data.sku !== "string" ||
      !data.sku.trim()
    )
  ) {
    throw createError(
      "Variant SKU must be a non-empty string.",
      400
    );
  }

  /*
  |--------------------------------------------------------------------------
  | Name Validation
  |--------------------------------------------------------------------------
  */

  if (
    data.name !== undefined &&
    (
      typeof data.name !== "string" ||
      !data.name.trim()
    )
  ) {
    throw createError(
      "Variant name must be a non-empty string.",
      400
    );
  }

  /*
  |--------------------------------------------------------------------------
  | Color Validation
  |--------------------------------------------------------------------------
  */

  if (
    data.color !== undefined &&
    typeof data.color !== "string"
  ) {
    throw createError(
      "Color must be a string.",
      400
    );
  }

  /*
  |--------------------------------------------------------------------------
  | Color Code Validation
  |--------------------------------------------------------------------------
  */

  if (
    data.colorCode !== undefined &&
    data.colorCode !== null &&
    data.colorCode !== ""
  ) {
    if (
      typeof data.colorCode !== "string" ||
      !HEX_COLOR_REGEX.test(data.colorCode)
    ) {
      throw createError(
        "Color code must be a valid hex color.",
        400
      );
    }
  }

  /*
  |--------------------------------------------------------------------------
  | Blouse Option Validation
  |--------------------------------------------------------------------------
  */

  if (
    data.blouseOption !== undefined &&
    !ALLOWED_BLOUSE_OPTIONS.includes(
      data.blouseOption
    )
  ) {
    throw createError(
      "Invalid blouse option.",
      400
    );
  }

  /*
  |--------------------------------------------------------------------------
  | Price Adjustment Validation
  |--------------------------------------------------------------------------
  */

  if (
    !partial &&
    data.priceAdjustment === undefined
  ) {
    // Price adjustment is optional; schema default is zero.
  }

  if (data.priceAdjustment !== undefined) {
    if (
      typeof data.priceAdjustment !== "number" ||
      !Number.isFinite(data.priceAdjustment)
    ) {
      throw createError(
        "Price adjustment must be a valid number.",
        400
      );
    }
  }

  /*
  |--------------------------------------------------------------------------
  | Image Validation
  |--------------------------------------------------------------------------
  */

  if (data.image !== undefined) {
    if (
      !data.image ||
      typeof data.image !== "object" ||
      Array.isArray(data.image)
    ) {
      throw createError(
        "Image must be an object containing url and publicId.",
        400
      );
    }

    if (
      data.image.url !== undefined &&
      typeof data.image.url !== "string"
    ) {
      throw createError(
        "Image URL must be a string.",
        400
      );
    }

    if (
      data.image.publicId !== undefined &&
      typeof data.image.publicId !== "string"
    ) {
      throw createError(
        "Image publicId must be a string.",
        400
      );
    }
  }

  /*
  |--------------------------------------------------------------------------
  | Status Validation
  |--------------------------------------------------------------------------
  */

  if (
    data.isActive !== undefined &&
    typeof data.isActive !== "boolean"
  ) {
    throw createError(
      "isActive must be a boolean.",
      400
    );
  }
};

/*
|--------------------------------------------------------------------------
| Find Product
|--------------------------------------------------------------------------
*/

const findProduct = async (productId) => {
  validateProductId(productId);

  const product = await Product.findById(productId);

  if (!product) {
    throw createError(
      "Product not found.",
      404
    );
  }

  return product;
};

/*
|--------------------------------------------------------------------------
| Find Variant Belonging to Product
|--------------------------------------------------------------------------
*/

const findVariant = async (
  productId,
  variantId
) => {
  const product = await findProduct(productId);

  validateVariantId(variantId);

  const variant = await ProductVariant.findOne({
    _id: variantId,
    product: product._id,
  });

  if (!variant) {
    throw createError(
      "Product variant not found.",
      404
    );
  }

  return variant;
};

/*
|--------------------------------------------------------------------------
| Create Product Variant
|--------------------------------------------------------------------------
*/

export const createProductVariant = async (
  productId,
  data,
  adminId
) => {
  validateAdminId(adminId);

  validateVariantData(data);

  const product = await findProduct(productId);

  const {
    sku,
    name,
    color,
    colorCode,
    blouseOption,
    priceAdjustment,
    image,
  } = data;

  if (
    typeof sku !== "string" ||
    !sku.trim()
  ) {
    throw createError(
      "Variant SKU is required.",
      400
    );
  }

  if (
    typeof name !== "string" ||
    !name.trim()
  ) {
    throw createError(
      "Variant name is required.",
      400
    );
  }

  const normalizedSku = sku
    .trim()
    .toUpperCase();

  const existingVariant =
    await ProductVariant.findOne({
      sku: normalizedSku,
    });

  if (existingVariant) {
    throw createError(
      "A variant with this SKU already exists.",
      409
    );
  }

  try {
    const variant = await ProductVariant.create({
      product: product._id,
      sku: normalizedSku,
      name: name.trim(),
      color: color?.trim() || "",
      colorCode: colorCode || null,
      blouseOption:
        blouseOption || "with_blouse",
      priceAdjustment:
        priceAdjustment === undefined
          ? 0
          : priceAdjustment,
      image: {
        url: image?.url?.trim() || "",
        publicId:
          image?.publicId?.trim() || "",
      },
      isActive: true,
    });

    return variant;
  } catch (error) {
    // MongoDB unique-index duplicate key error.
    if (error.code === 11000) {
      throw createError(
        "A variant with this SKU already exists.",
        409
      );
    }

    throw error;
  }
};

/*
|--------------------------------------------------------------------------
| List Product Variants
|--------------------------------------------------------------------------
*/

export const listProductVariants = async (
  productId,
  options = {}
) => {
  const product = await findProduct(productId);

  const filter = {
    product: product._id,
  };

  if (options.activeOnly === true) {
    filter.isActive = true;
  }

  return ProductVariant.find(filter)
    .sort({
      isActive: -1,
      createdAt: 1,
    })
    .lean();
};

/*
|--------------------------------------------------------------------------
| Get Single Product Variant
|--------------------------------------------------------------------------
*/

export const getProductVariant = async (
  productId,
  variantId
) => {
  const variant = await findVariant(
    productId,
    variantId
  );

  return variant.toObject();
};

/*
|--------------------------------------------------------------------------
| Update Product Variant
|--------------------------------------------------------------------------
*/

export const updateProductVariant = async (
  productId,
  variantId,
  data,
  adminId
) => {
  validateAdminId(adminId);

  validateVariantData(data, {
    partial: true,
  });

  const variant = await findVariant(
    productId,
    variantId
  );

  /*
  |--------------------------------------------------------------------------
  | Update SKU
  |--------------------------------------------------------------------------
  */

  if (data.sku !== undefined) {
    const normalizedSku = data.sku
      .trim()
      .toUpperCase();

    const duplicateSku =
      await ProductVariant.findOne({
        sku: normalizedSku,
        _id: {
          $ne: variant._id,
        },
      });

    if (duplicateSku) {
      throw createError(
        "A variant with this SKU already exists.",
        409
      );
    }

    variant.sku = normalizedSku;
  }

  /*
  |--------------------------------------------------------------------------
  | Update Name
  |--------------------------------------------------------------------------
  */

  if (data.name !== undefined) {
    variant.name = data.name.trim();
  }

  /*
  |--------------------------------------------------------------------------
  | Update Color
  |--------------------------------------------------------------------------
  */

  if (data.color !== undefined) {
    variant.color = data.color.trim();
  }

  /*
  |--------------------------------------------------------------------------
  | Update Color Code
  |--------------------------------------------------------------------------
  */

  if (data.colorCode !== undefined) {
    variant.colorCode =
      data.colorCode || null;
  }

  /*
  |--------------------------------------------------------------------------
  | Update Blouse Option
  |--------------------------------------------------------------------------
  */

  if (data.blouseOption !== undefined) {
    variant.blouseOption =
      data.blouseOption;
  }

  /*
  |--------------------------------------------------------------------------
  | Update Price Adjustment
  |--------------------------------------------------------------------------
  */

  if (data.priceAdjustment !== undefined) {
    variant.priceAdjustment =
      data.priceAdjustment;
  }

  /*
  |--------------------------------------------------------------------------
  | Update Image
  |--------------------------------------------------------------------------
  */

  if (data.image !== undefined) {
    variant.image = {
      url: data.image.url?.trim() || "",
      publicId:
        data.image.publicId?.trim() || "",
    };
  }

  /*
  |--------------------------------------------------------------------------
  | Update Status
  |--------------------------------------------------------------------------
  */

  if (data.isActive !== undefined) {
    variant.isActive = data.isActive;
  }

  try {
    await variant.save();

    return variant;
  } catch (error) {
    if (error.code === 11000) {
      throw createError(
        "A variant with this SKU already exists.",
        409
      );
    }

    throw error;
  }
};

/*
|--------------------------------------------------------------------------
| Activate / Deactivate Product Variant
|--------------------------------------------------------------------------
*/

export const updateProductVariantStatus = async (
  productId,
  variantId,
  isActive,
  adminId
) => {
  validateAdminId(adminId);

  if (typeof isActive !== "boolean") {
    throw createError(
      "isActive must be a boolean.",
      400
    );
  }

  const variant = await findVariant(
    productId,
    variantId
  );

  variant.isActive = isActive;

  await variant.save();

  return variant;
};

/*
|--------------------------------------------------------------------------
| Delete Product Variant
|--------------------------------------------------------------------------
| Soft delete: deactivate instead of permanently
| deleting the database document.
|--------------------------------------------------------------------------
*/

export const deleteProductVariant = async (
  productId,
  variantId,
  adminId
) => {
  return updateProductVariantStatus(
    productId,
    variantId,
    false,
    adminId
  );
};