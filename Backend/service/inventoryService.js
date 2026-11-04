import Inventory from "../models/Inventory.js";
import Product from "../models/Product.js";
import ProductVariant from "../models/ProductVariant.js";

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

const validateObjectId = (value, fieldName) => {
  const id = String(value ?? "");

  if (!isValidObjectId(id)) {
    throw createError(
      `Invalid ${fieldName}.`,
      400
    );
  }

  return id;
};

const validateAdminId = (adminId) => {
  return validateObjectId(adminId, "admin ID");
};

const validateInteger = (
  value,
  fieldName,
  { min = 0, allowZero = true } = {}
) => {
  const parsed = Number(value);

  if (
    value === undefined ||
    value === null ||
    value === "" ||
    !Number.isInteger(parsed) ||
    parsed < min ||
    (!allowZero && parsed === 0)
  ) {
    throw createError(
      `${fieldName} must be a valid integer ${
        allowZero
          ? `greater than or equal to ${min}`
          : `greater than ${min - 1}`
      }.`,
      400
    );
  }

  return parsed;
};

const parseBoolean = (value, fieldName) => {
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

const handleInventoryError = (error) => {
  if (error.statusCode) {
    throw error;
  }

  if (error.code === 11000) {
    throw createError(
      "Inventory already exists for this product or variant.",
      409
    );
  }

  if (error.name === "ValidationError") {
    throw createError(error.message, 400);
  }

  throw error;
};

/*
|--------------------------------------------------------------------------
| Inventory Response Helper
|--------------------------------------------------------------------------
|
| Mongoose virtuals may not be included in lean() results.
| Calculate availableQuantity explicitly for consistent API responses.
|
*/

const formatInventory = (inventory) => {
  if (!inventory) {
    return null;
  }

  const result =
    typeof inventory.toObject === "function"
      ? inventory.toObject()
      : { ...inventory };

  result.availableQuantity =
    result.quantity - result.reservedQuantity;

  return result;
};

/*
|--------------------------------------------------------------------------
| Population Helper
|--------------------------------------------------------------------------
*/

const populateInventory = (query) => {
  return query
    .populate({
      path: "product",
      select: "name slug sku status category primaryImage basePrice",
      populate: {
        path: "category",
        select: "name",
      },
    })
    .populate(
      "variant",
      "name sku color colorCode blouseOption isActive"
    );
};

/*
|--------------------------------------------------------------------------
| Validate Product / Variant Relationship
|--------------------------------------------------------------------------
*/

const validateInventoryTarget = async ({
  inventoryType,
  productId,
  variantId,
}) => {
  if (!["product", "variant"].includes(inventoryType)) {
    throw createError(
      "Inventory type must be product or variant.",
      400
    );
  }

  const product = await Product.findById(productId)
    .select("_id name");

  if (!product) {
    throw createError(
      "Product not found.",
      404
    );
  }

  if (inventoryType === "product") {
    if (
      variantId !== undefined &&
      variantId !== null &&
      variantId !== ""
    ) {
      throw createError(
        "Product-level inventory must not include a variant ID.",
        400
      );
    }

    return;
  }

  if (
    variantId === undefined ||
    variantId === null ||
    variantId === ""
  ) {
    throw createError(
      "Variant ID is required for variant inventory.",
      400
    );
  }

  const variantObjectId = validateObjectId(
    variantId,
    "variant ID"
  );

  const variant = await ProductVariant.findOne({
    _id: variantObjectId,
    product: productId,
  }).select("_id product");

  if (!variant) {
    throw createError(
      "Variant not found for the specified product.",
      404
    );
  }
};

/*
|--------------------------------------------------------------------------
| 1. Create Inventory
|--------------------------------------------------------------------------
|
| Initial reserved quantity is always zero.
| Inventory can only be created for an existing product or its variant.
|
*/

export const createInventory = async (
  data,
  adminId
) => {
  try {
    if (!data || typeof data !== "object") {
      throw createError(
        "Inventory data is required.",
        400
      );
    }

    const validatedAdminId =
      validateAdminId(adminId);

    const productId = validateObjectId(
      data.product,
      "product ID"
    );

    const { inventoryType } = data;

    await validateInventoryTarget({
      inventoryType,
      productId,
      variantId: data.variant,
    });

    const quantity = validateInteger(
      data.quantity ?? 0,
      "Quantity"
    );

    const lowStockThreshold = validateInteger(
      data.lowStockThreshold ?? 5,
      "Low stock threshold"
    );

    const inventoryData = {
      inventoryType,
      product: productId,
      variant:
        inventoryType === "variant"
          ? String(data.variant)
          : null,
      quantity,
      reservedQuantity: 0,
      lowStockThreshold,
      lastRestockedAt:
        quantity > 0 ? new Date() : null,
      updatedBy: validatedAdminId,
    };

    const inventory = await Inventory.create(
      inventoryData
    );

    await inventory.populate([
      {
        path: "product",
        select: "name slug sku status",
      },
      {
        path: "variant",
        select:
          "name sku color colorCode blouseOption isActive",
      },
    ]);

    return formatInventory(inventory);
  } catch (error) {
    handleInventoryError(error);
  }
};

/*
|--------------------------------------------------------------------------
| 2. List Inventory
|--------------------------------------------------------------------------
|
| Supports pagination and optional filters:
| inventoryType, productId, variantId, lowStockOnly.
|
*/

export const listInventory = async ({
  page = 1,
  limit = 20,
  inventoryType,
  productId,
  variantId,
  lowStockOnly = false,
} = {}) => {
  const parsedPage = validateInteger(
    page,
    "Page",
    { min: 1, allowZero: false }
  );

  const parsedLimit = validateInteger(
    limit,
    "Limit",
    { min: 1, allowZero: false }
  );

  if (parsedLimit > 100) {
    throw createError(
      "Limit cannot exceed 100.",
      400
    );
  }

  const filter = {};

  if (inventoryType !== undefined && inventoryType !== "") {
    if (!["product", "variant"].includes(inventoryType)) {
      throw createError(
        "Invalid inventory type filter.",
        400
      );
    }

    filter.inventoryType = inventoryType;
  }

  if (productId !== undefined && productId !== "") {
    filter.product = validateObjectId(
      productId,
      "product ID"
    );
  }

  if (variantId !== undefined && variantId !== "") {
    filter.variant = validateObjectId(
      variantId,
      "variant ID"
    );
  }

  const showLowStock = parseBoolean(
    lowStockOnly,
    "lowStockOnly"
  );

  if (showLowStock) {
    /*
     * Available stock is quantity - reservedQuantity.
     * Find records where available stock is at or below
     * the configured low-stock threshold.
     */
    filter.$expr = {
      $lte: [
        {
          $subtract: [
            "$quantity",
            "$reservedQuantity",
          ],
        },
        "$lowStockThreshold",
      ],
    };
  }

  const skip =
    (parsedPage - 1) * parsedLimit;

  const [inventories, total] = await Promise.all([
    populateInventory(
      Inventory.find(filter)
        .sort({
          updatedAt: -1,
          _id: -1,
        })
        .skip(skip)
        .limit(parsedLimit)
    ).lean(),

    Inventory.countDocuments(filter),
  ]);

  return {
    inventories: inventories.map(formatInventory),

    pagination: {
      page: parsedPage,
      limit: parsedLimit,
      total,
      totalPages: Math.ceil(
        total / parsedLimit
      ),
    },
  };
};

/*
|--------------------------------------------------------------------------
| 3. Get Inventory By ID
|--------------------------------------------------------------------------
*/

export const getInventoryById = async (
  inventoryId
) => {
  const id = validateObjectId(
    inventoryId,
    "inventory ID"
  );

  const inventory = await populateInventory(
    Inventory.findById(id)
  ).lean();

  if (!inventory) {
    throw createError(
      "Inventory not found.",
      404
    );
  }

  return formatInventory(inventory);
};

/*
|--------------------------------------------------------------------------
| 4. Get Product-Level Inventory
|--------------------------------------------------------------------------
*/

export const getInventoryByProduct = async (
  productId
) => {
  const id = validateObjectId(
    productId,
    "product ID"
  );

  const inventory = await populateInventory(
    Inventory.findOne({
      product: id,
      inventoryType: "product",
    })
  ).lean();

  if (!inventory) {
    throw createError(
      "Product-level inventory not found.",
      404
    );
  }

  return formatInventory(inventory);
};

/*
|--------------------------------------------------------------------------
| 5. Get Variant-Level Inventory
|--------------------------------------------------------------------------
*/

export const getInventoryByVariant = async (
  variantId
) => {
  const id = validateObjectId(
    variantId,
    "variant ID"
  );

  const inventory = await populateInventory(
    Inventory.findOne({
      variant: id,
      inventoryType: "variant",
    })
  ).lean();

  if (!inventory) {
    throw createError(
      "Variant-level inventory not found.",
      404
    );
  }

  return formatInventory(inventory);
};

/*
|--------------------------------------------------------------------------
| 6. Adjust Inventory Quantity
|--------------------------------------------------------------------------
|
| Positive adjustment = add stock.
| Negative adjustment = remove stock.
|
| Stock cannot be reduced below reserved quantity.
| Updates are atomic to reduce race-condition risks.
|
*/

export const adjustInventoryQuantity = async (
  inventoryId,
  adjustment,
  adminId
) => {
  const id = validateObjectId(
    inventoryId,
    "inventory ID"
  );

  const validatedAdminId =
    validateAdminId(adminId);

  const quantityAdjustment = Number(adjustment);

  if (
    !Number.isInteger(quantityAdjustment) ||
    quantityAdjustment === 0
  ) {
    throw createError(
      "Quantity adjustment must be a non-zero integer.",
      400
    );
  }

  const filter = {
    _id: id,
  };

  if (quantityAdjustment < 0) {
    const quantityToRemove =
      Math.abs(quantityAdjustment);

    /*
     * Allow stock reduction only when the remaining
     * available stock covers the requested adjustment.
     */
    filter.$expr = {
      $gte: [
        {
          $subtract: [
            "$quantity",
            "$reservedQuantity",
          ],
        },
        quantityToRemove,
      ],
    };
  }

  const update = {
    $inc: {
      quantity: quantityAdjustment,
    },

    $set: {
      updatedBy: validatedAdminId,
    },
  };

  if (quantityAdjustment > 0) {
    update.$set.lastRestockedAt = new Date();
  }

  const inventory = await Inventory.findOneAndUpdate(
    filter,
    update,
    {
      returnDocument: "after",
      runValidators: true,
    }
  );

  if (!inventory) {
    const existingInventory =
      await Inventory.findById(id).select("_id");

    if (!existingInventory) {
      throw createError(
        "Inventory not found.",
        404
      );
    }

    throw createError(
      "Insufficient available stock for this adjustment. Reserved stock cannot be removed.",
      409
    );
  }

  await inventory.populate([
    {
      path: "product",
      select: "name slug sku status",
    },
    {
      path: "variant",
      select:
        "name sku color colorCode blouseOption isActive",
    },
  ]);

  return formatInventory(inventory);
};

/*
|--------------------------------------------------------------------------
| 7. Update Low-Stock Threshold
|--------------------------------------------------------------------------
*/

export const updateInventoryThreshold = async (
  inventoryId,
  threshold,
  adminId
) => {
  const id = validateObjectId(
    inventoryId,
    "inventory ID"
  );

  const validatedAdminId =
    validateAdminId(adminId);

  const lowStockThreshold = validateInteger(
    threshold,
    "Low stock threshold"
  );

  const inventory = await Inventory.findByIdAndUpdate(
    id,
    {
      $set: {
        lowStockThreshold,
        updatedBy: validatedAdminId,
      },
    },
    {
      returnDocument: "after",
      runValidators: true,
    }
  );

  if (!inventory) {
    throw createError(
      "Inventory not found.",
      404
    );
  }

  await inventory.populate([
    {
      path: "product",
      select: "name slug sku status",
    },
    {
      path: "variant",
      select:
        "name sku color colorCode blouseOption isActive",
    },
  ]);

  return formatInventory(inventory);
};

/*
|--------------------------------------------------------------------------
| 8. List Low-Stock Inventory
|--------------------------------------------------------------------------
*/

export const listLowStockInventory = async ({
  page = 1,
  limit = 20,
  inventoryType,
} = {}) => {
  return listInventory({
    page,
    limit,
    inventoryType,
    lowStockOnly: true,
  });
};