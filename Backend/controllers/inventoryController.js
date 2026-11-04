import {
  createInventory as createInventoryService,
  listInventory as listInventoryService,
  getInventoryById as getInventoryByIdService,
  getInventoryByProduct as getInventoryByProductService,
  getInventoryByVariant as getInventoryByVariantService,
  adjustInventoryQuantity as adjustInventoryQuantityService,
  updateInventoryThreshold as updateInventoryThresholdService,
  listLowStockInventory as listLowStockInventoryService,
} from "../service/inventoryService.js";

/*
|--------------------------------------------------------------------------
| Common Helpers
|--------------------------------------------------------------------------
*/

const requireAdmin = (req, res) => {
  if (!req.admin?.adminId) {
    res.status(401).json({
      success: false,
      message: "Admin authentication required.",
    });

    return null;
  }

  return req.admin.adminId;
};

/*
|--------------------------------------------------------------------------
| 1. Create Inventory
|--------------------------------------------------------------------------
| POST /api/v1/admin/inventory
|
| Creates product-level or variant-level inventory.
|--------------------------------------------------------------------------
*/

export const createInventoryController = async (
  req,
  res,
  next
) => {
  try {
    const adminId = requireAdmin(req, res);

    if (!adminId) {
      return;
    }

    const inventory = await createInventoryService(
      req.validatedBody ?? req.body,
      adminId
    );

    return res.status(201).json({
      success: true,
      message: "Inventory created successfully.",
      inventory,
    });
  } catch (error) {
    return next(error);
  }
};

/*
|--------------------------------------------------------------------------
| 2. List Inventory
|--------------------------------------------------------------------------
| GET /api/v1/admin/inventory
|
| Optional query parameters:
| page, limit, inventoryType, productId, variantId,
| lowStockOnly
|--------------------------------------------------------------------------
*/

export const listInventoryController = async (
  req,
  res,
  next
) => {
  try {
    const {
      page,
      limit,
      inventoryType,
      productId,
      variantId,
      lowStockOnly,
    } = req.query;

    const result = await listInventoryService({
      page,
      limit,
      inventoryType,
      productId,
      variantId,
      lowStockOnly,
    });

    return res.status(200).json({
      success: true,
      message: "Inventory retrieved successfully.",
      ...result,
    });
  } catch (error) {
    return next(error);
  }
};

/*
|--------------------------------------------------------------------------
| 3. Get Inventory By ID
|--------------------------------------------------------------------------
| GET /api/v1/admin/inventory/:inventoryId
|--------------------------------------------------------------------------
*/

export const getInventoryByIdController = async (
  req,
  res,
  next
) => {
  try {
    const inventory = await getInventoryByIdService(
      req.params.inventoryId
    );

    return res.status(200).json({
      success: true,
      message: "Inventory retrieved successfully.",
      inventory,
    });
  } catch (error) {
    return next(error);
  }
};

/*
|--------------------------------------------------------------------------
| 4. Get Product-Level Inventory
|--------------------------------------------------------------------------
| GET /api/v1/admin/inventory/product/:productId
|--------------------------------------------------------------------------
*/

export const getInventoryByProductController = async (
  req,
  res,
  next
) => {
  try {
    const inventory =
      await getInventoryByProductService(
        req.params.productId
      );

    return res.status(200).json({
      success: true,
      message: "Product inventory retrieved successfully.",
      inventory,
    });
  } catch (error) {
    return next(error);
  }
};

/*
|--------------------------------------------------------------------------
| 5. Get Variant-Level Inventory
|--------------------------------------------------------------------------
| GET /api/v1/admin/inventory/variant/:variantId
|--------------------------------------------------------------------------
*/

export const getInventoryByVariantController = async (
  req,
  res,
  next
) => {
  try {
    const inventory =
      await getInventoryByVariantService(
        req.params.variantId
      );

    return res.status(200).json({
      success: true,
      message: "Variant inventory retrieved successfully.",
      inventory,
    });
  } catch (error) {
    return next(error);
  }
};

/*
|--------------------------------------------------------------------------
| 6. Adjust Inventory Quantity
|--------------------------------------------------------------------------
| PATCH /api/v1/admin/inventory/:inventoryId/adjust
|
| Request body:
| {
|   "adjustment": 10
| }
|
| Positive adjustment adds stock.
| Negative adjustment removes stock.
|--------------------------------------------------------------------------
*/

export const adjustInventoryQuantityController = async (
  req,
  res,
  next
) => {
  try {
    const adminId = requireAdmin(req, res);

    if (!adminId) {
      return;
    }

    const body = req.validatedBody ?? req.body;

    const inventory =
      await adjustInventoryQuantityService(
        req.params.inventoryId,
        body.adjustment,
        adminId
      );

    return res.status(200).json({
      success: true,
      message: "Inventory quantity adjusted successfully.",
      inventory,
    });
  } catch (error) {
    return next(error);
  }
};

/*
|--------------------------------------------------------------------------
| 7. Update Low-Stock Threshold
|--------------------------------------------------------------------------
| PATCH /api/v1/admin/inventory/:inventoryId/threshold
|
| Request body:
| {
|   "lowStockThreshold": 5
| }
|--------------------------------------------------------------------------
*/

export const updateInventoryThresholdController = async (
  req,
  res,
  next
) => {
  try {
    const adminId = requireAdmin(req, res);

    if (!adminId) {
      return;
    }

    const body = req.validatedBody ?? req.body;

    const inventory =
      await updateInventoryThresholdService(
        req.params.inventoryId,
        body.lowStockThreshold,
        adminId
      );

    return res.status(200).json({
      success: true,
      message: "Low-stock threshold updated successfully.",
      inventory,
    });
  } catch (error) {
    return next(error);
  }
};

/*
|--------------------------------------------------------------------------
| 8. List Low-Stock Inventory
|--------------------------------------------------------------------------
| GET /api/v1/admin/inventory/low-stock
|
| Optional query parameters:
| page, limit, inventoryType
|--------------------------------------------------------------------------
*/

export const listLowStockInventoryController = async (
  req,
  res,
  next
) => {
  try {
    const {
      page,
      limit,
      inventoryType,
    } = req.query;

    const result =
      await listLowStockInventoryService({
        page,
        limit,
        inventoryType,
      });

    return res.status(200).json({
      success: true,
      message: "Low-stock inventory retrieved successfully.",
      ...result,
    });
  } catch (error) {
    return next(error);
  }
};