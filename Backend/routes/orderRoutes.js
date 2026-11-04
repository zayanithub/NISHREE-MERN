import { Router } from "express";

import {
  createOrderController,
  listCustomerOrdersController,
  getCustomerOrderSummaryController,
  getCustomerOrderByIdController,
  cancelCustomerOrderController,
} from "../controllers/orderController.js";

import {
  getCustomerShipmentByOrderIdController,
} from "../controllers/shippingController.js";

import authMiddleware from "../middlewares/authMiddleware.js";

const router = Router();

/*
|--------------------------------------------------------------------------
| Customer Order Routes
|--------------------------------------------------------------------------
|
| All customer order endpoints require a valid customer JWT.
| The customer ID comes from req.auth.userId.
|
*/

router.use(authMiddleware);

/*
|--------------------------------------------------------------------------
| 1. Create Order
|--------------------------------------------------------------------------
| POST /api/v1/orders
|--------------------------------------------------------------------------
*/

router.post(
  "/",
  createOrderController
);

/*
|--------------------------------------------------------------------------
| 2. List Customer Orders
|--------------------------------------------------------------------------
| GET /api/v1/orders
|--------------------------------------------------------------------------
*/

router.get(
  "/",
  listCustomerOrdersController
);

router.get(
  "/summary",
  getCustomerOrderSummaryController
);

/*
|--------------------------------------------------------------------------
| 3. Cancel Customer Order
|--------------------------------------------------------------------------
| PATCH /api/v1/orders/:orderId/cancel
|--------------------------------------------------------------------------
*/

router.patch(
  "/:orderId/cancel",
  cancelCustomerOrderController
);

/*
|--------------------------------------------------------------------------
| 4. Get Customer Order By ID
|--------------------------------------------------------------------------
| GET /api/v1/orders/:orderId
|--------------------------------------------------------------------------
*/

router.get(
  "/:orderId",
  getCustomerOrderByIdController
);


/*
|--------------------------------------------------------------------------
| Customer Shipment Tracking
|--------------------------------------------------------------------------
| GET /api/v1/orders/:orderId/shipment
|--------------------------------------------------------------------------
*/

router.get(
  "/:orderId/shipment",
  getCustomerShipmentByOrderIdController
);

export default router;