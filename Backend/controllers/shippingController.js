import {
  createShipment,
  listAdminShipments,
  listEligibleOrdersForShipping,
  getAdminShipmentById,
  updateShipmentDetails,
  updateShipmentStatus,
  getCustomerShipmentByOrderId,
} from "../service/shippingService.js";

/*
|--------------------------------------------------------------------------
| Common Error Handler
|--------------------------------------------------------------------------
*/

const handleControllerError = (
  res,
  error,
  context
) => {
  if (error.statusCode) {
    return res.status(error.statusCode).json({
      success: false,
      message: error.message,
    });
  }

  if (
    error.name === "ValidationError" ||
    error.name === "CastError"
  ) {
    return res.status(400).json({
      success: false,
      message: error.message,
    });
  }

  if (error.code === 11000) {
    return res.status(409).json({
      success: false,
      message: "A duplicate shipment record was detected.",
    });
  }

  console.error(`${context}:`, error);

  return res.status(500).json({
    success: false,
    message: "An internal server error occurred.",
  });
};

/*
|--------------------------------------------------------------------------
| 1. Create Shipment — Admin
|--------------------------------------------------------------------------
| POST /api/v1/admin/shipping
|
| Body:
| {
|   "orderId": "...",
|   "carrier": "Example Courier",
|   "serviceType": "standard",
|   "trackingNumber": "TRACK123",
|   "trackingUrl": "https://example.com/track/TRACK123",
|   "shippingCost": 0
| }
|--------------------------------------------------------------------------
*/

export const createShipmentController = async (
  req,
  res
) => {
  try {
    const {
      orderId,
      ...shipmentData
    } = req.body ?? {};

    const shipment = await createShipment(
      req.admin?.adminId,
      orderId,
      shipmentData
    );

    return res.status(201).json({
      success: true,
      message: "Shipment created successfully.",
      data: {
        shipment,
      },
    });
  } catch (error) {
    return handleControllerError(
      res,
      error,
      "Create shipment error"
    );
  }
};

/*
|--------------------------------------------------------------------------
| 2. List Shipments — Admin
|--------------------------------------------------------------------------
| GET /api/v1/admin/shipping
|
| Query:
| page, limit, status, trackingNumber
|--------------------------------------------------------------------------
*/

export const listAdminShipmentsController = async (
  req,
  res
) => {
  try {
    const result = await listAdminShipments(
      req.query
    );

    return res.status(200).json({
      success: true,
      message: "Shipments retrieved successfully.",
      data: result,
    });
  } catch (error) {
    return handleControllerError(
      res,
      error,
      "List admin shipments error"
    );
  }
};

export const listEligibleOrdersForShippingController = async (
  req,
  res
) => {
  try {
    const result = await listEligibleOrdersForShipping(req.query);
    return res.status(200).json({
      success: true,
      message: "Shipment-eligible orders retrieved successfully.",
      data: result,
    });
  } catch (error) {
    return handleControllerError(
      res,
      error,
      "List shipment-eligible orders error"
    );
  }
};

/*
|--------------------------------------------------------------------------
| 3. Get Shipment By ID — Admin
|--------------------------------------------------------------------------
| GET /api/v1/admin/shipping/:shippingId
|--------------------------------------------------------------------------
*/

export const getAdminShipmentByIdController = async (
  req,
  res
) => {
  try {
    const shipment = await getAdminShipmentById(
      req.params.shippingId
    );

    return res.status(200).json({
      success: true,
      message: "Shipment retrieved successfully.",
      data: {
        shipment,
      },
    });
  } catch (error) {
    return handleControllerError(
      res,
      error,
      "Get admin shipment error"
    );
  }
};

/*
|--------------------------------------------------------------------------
| 4. Update Shipment Details — Admin
|--------------------------------------------------------------------------
| PATCH /api/v1/admin/shipping/:shippingId
|--------------------------------------------------------------------------
*/

export const updateShipmentDetailsController = async (
  req,
  res
) => {
  try {
    const shipment = await updateShipmentDetails(
      req.params.shippingId,
      req.body
    );

    return res.status(200).json({
      success: true,
      message: "Shipment details updated successfully.",
      data: {
        shipment,
      },
    });
  } catch (error) {
    return handleControllerError(
      res,
      error,
      "Update shipment details error"
    );
  }
};

/*
|--------------------------------------------------------------------------
| 5. Update Shipment Status — Admin
|--------------------------------------------------------------------------
| PATCH /api/v1/admin/shipping/:shippingId/status
|
| Body:
| {
|   "status": "ready_to_ship"
| }
|--------------------------------------------------------------------------
*/

export const updateShipmentStatusController = async (
  req,
  res
) => {
  try {
    const {
      status,
      ...statusData
    } = req.body ?? {};

    const shipment = await updateShipmentStatus(
      req.params.shippingId,
      status,
      statusData
    );

    return res.status(200).json({
      success: true,
      message: "Shipment status updated successfully.",
      data: {
        shipment,
      },
    });
  } catch (error) {
    return handleControllerError(
      res,
      error,
      "Update shipment status error"
    );
  }
};

/*
|--------------------------------------------------------------------------
| 6. Customer Shipment Tracking
|--------------------------------------------------------------------------
| GET /api/v1/orders/:orderId/shipment
|
| Customer authentication is required.
| Customers can only view their own order.
|--------------------------------------------------------------------------
*/

export const getCustomerShipmentByOrderIdController = async (
  req,
  res
) => {
  try {
    const result = await getCustomerShipmentByOrderId(
      req.auth?.userId,
      req.params.orderId
    );

    return res.status(200).json({
      success: true,
      message: "Shipment tracking retrieved successfully.",
      data: result,
    });
  } catch (error) {
    return handleControllerError(
      res,
      error,
      "Get customer shipment tracking error"
    );
  }
};