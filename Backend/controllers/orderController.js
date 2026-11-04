import {
  createOrder as createOrderService,
  listCustomerOrders as listCustomerOrdersService,
  getCustomerOrderSummary as getCustomerOrderSummaryService,
  getCustomerOrderById as getCustomerOrderByIdService,
  cancelCustomerOrder as cancelCustomerOrderService,
  listAdminOrders as listAdminOrdersService,
  getAdminOrderById as getAdminOrderByIdService,
  updateOrderStatus as updateOrderStatusService,
} from "../service/orderService.js";

/*
|--------------------------------------------------------------------------
| Common Authentication Helpers
|--------------------------------------------------------------------------
*/

const requireCustomer = (req, res) => {
  const userId = req.auth?.userId;

  if (
    !userId ||
    req.auth?.accountType !== "user"
  ) {
    res.status(401).json({
      success: false,
      message: "Customer authentication required.",
    });

    return null;
  }

  return userId;
};

const requireAdmin = (req, res) => {
  const adminId = req.admin?.adminId;

  if (!adminId) {
    res.status(401).json({
      success: false,
      message: "Admin authentication required.",
    });

    return null;
  }

  return adminId;
};

/*
|--------------------------------------------------------------------------
| 1. Create Customer Order
|--------------------------------------------------------------------------
| POST /api/v1/orders
|
| Expected request body:
| {
|   "shippingAddressId": "ADDRESS_ID",
|   "billingAddressId": "OPTIONAL_ADDRESS_ID",
|   "paymentMethod": "cod",
|   "couponCode": "OPTIONAL_COUPON_CODE",
|   "notes": "Optional delivery instructions"
| }
|
| Product prices and quantities are calculated by the service.
|--------------------------------------------------------------------------
*/

export const createOrderController = async (
  req,
  res,
  next
) => {
  try {
    const userId = requireCustomer(req, res);

    if (!userId) {
      return;
    }

    const body = req.validatedBody ?? req.body;

    const order = await createOrderService(
      userId,
      body
    );

    return res.status(201).json({
      success: true,
      message: "Order created successfully.",
      order,
    });
  } catch (error) {
    return next(error);
  }
};

/*
|--------------------------------------------------------------------------
| 2. List Customer Orders
|--------------------------------------------------------------------------
| GET /api/v1/orders
|
| Optional query parameters:
| page, limit, status
|--------------------------------------------------------------------------
*/

export const listCustomerOrdersController = async (
  req,
  res,
  next
) => {
  try {
    const userId = requireCustomer(req, res);

    if (!userId) {
      return;
    }

    const result = await listCustomerOrdersService(
      userId,
      {
        page: req.query.page,
        limit: req.query.limit,
        status: req.query.status,
      }
    );

    return res.status(200).json({
      success: true,
      message: "Orders retrieved successfully.",
      ...result,
    });
  } catch (error) {
    return next(error);
  }
};

export const getCustomerOrderSummaryController = async (
  req,
  res,
  next
) => {
  try {
    const userId = requireCustomer(req, res);
    if (!userId) return;

    const summary = await getCustomerOrderSummaryService(userId);
    return res.status(200).json({
      success: true,
      message: "Order summary retrieved successfully.",
      summary,
    });
  } catch (error) {
    return next(error);
  }
};

/*
|--------------------------------------------------------------------------
| 3. Get Customer Order By ID
|--------------------------------------------------------------------------
| GET /api/v1/orders/:orderId
|--------------------------------------------------------------------------
*/

export const getCustomerOrderByIdController = async (
  req,
  res,
  next
) => {
  try {
    const userId = requireCustomer(req, res);

    if (!userId) {
      return;
    }

    const order = await getCustomerOrderByIdService(
      userId,
      req.params.orderId
    );

    return res.status(200).json({
      success: true,
      message: "Order retrieved successfully.",
      order,
    });
  } catch (error) {
    return next(error);
  }
};

/*
|--------------------------------------------------------------------------
| 4. Cancel Customer Order
|--------------------------------------------------------------------------
| PATCH /api/v1/orders/:orderId/cancel
|--------------------------------------------------------------------------
*/

export const cancelCustomerOrderController = async (
  req,
  res,
  next
) => {
  try {
    const userId = requireCustomer(req, res);

    if (!userId) {
      return;
    }

    const order = await cancelCustomerOrderService(
      userId,
      req.params.orderId
    );

    return res.status(200).json({
      success: true,
      message: "Order cancelled successfully.",
      order,
    });
  } catch (error) {
    return next(error);
  }
};

/*
|--------------------------------------------------------------------------
| 5. List Orders For Admin
|--------------------------------------------------------------------------
| GET /api/v1/admin/orders
|
| Optional query parameters:
| page, limit, status, paymentStatus, search
|--------------------------------------------------------------------------
*/

export const listAdminOrdersController = async (
  req,
  res,
  next
) => {
  try {
    const adminId = requireAdmin(req, res);

    if (!adminId) {
      return;
    }

    const result = await listAdminOrdersService({
      page: req.query.page,
      limit: req.query.limit,
      status: req.query.status,
      paymentStatus: req.query.paymentStatus,
      search: req.query.search,
    });

    return res.status(200).json({
      success: true,
      message: "Admin orders retrieved successfully.",
      ...result,
    });
  } catch (error) {
    return next(error);
  }
};

/*
|--------------------------------------------------------------------------
| 6. Get One Order For Admin
|--------------------------------------------------------------------------
| GET /api/v1/admin/orders/:orderId
|--------------------------------------------------------------------------
*/

export const getAdminOrderByIdController = async (
  req,
  res,
  next
) => {
  try {
    const adminId = requireAdmin(req, res);

    if (!adminId) {
      return;
    }

    const order = await getAdminOrderByIdService(
      req.params.orderId
    );

    return res.status(200).json({
      success: true,
      message: "Admin order retrieved successfully.",
      order,
    });
  } catch (error) {
    return next(error);
  }
};

/*
|--------------------------------------------------------------------------
| 7. Update Order Status For Admin
|--------------------------------------------------------------------------
| PATCH /api/v1/admin/orders/:orderId/status
|
| Request body:
| {
|   "status": "processing"
| }
|
| Service validates allowed status transitions.
|--------------------------------------------------------------------------
*/

export const updateAdminOrderStatusController = async (
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

    if (
      !body ||
      typeof body !== "object" ||
      Array.isArray(body) ||
      Object.keys(body).length !== 1 ||
      typeof body.status !== "string"
    ) {
      return res.status(400).json({
        success: false,
        message: "Request body must contain only a valid status field.",
      });
    }

    const order = await updateOrderStatusService(
      req.params.orderId,
      body.status
    );

    return res.status(200).json({
      success: true,
      message: "Order status updated successfully.",
      order,
    });
  } catch (error) {
    return next(error);
  }
};