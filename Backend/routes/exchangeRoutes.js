import { Router } from "express";

import {
  createCustomerExchangeRequestController,
  listCustomerExchangeRequestsController,
  getCustomerExchangeRequestByIdController,
  cancelCustomerExchangeRequestController,
} from "../controllers/exchangeController.js";

import authMiddleware from "../middlewares/authMiddleware.js";

const router = Router();

/*
|--------------------------------------------------------------------------
| Customer Exchange Routes
|--------------------------------------------------------------------------
|
| All endpoints require a valid customer JWT.
| The customer ID comes from req.auth.userId.
|
*/

router.use(authMiddleware);

/*
|--------------------------------------------------------------------------
| 1. Create Exchange Request
|--------------------------------------------------------------------------
| POST /api/v1/exchanges
|--------------------------------------------------------------------------
*/

router.post(
  "/",
  createCustomerExchangeRequestController
);

/*
|--------------------------------------------------------------------------
| 2. List Customer Exchange Requests
|--------------------------------------------------------------------------
| GET /api/v1/exchanges
|
| Query parameters:
| page, limit, status
|--------------------------------------------------------------------------
*/

router.get(
  "/",
  listCustomerExchangeRequestsController
);

/*
|--------------------------------------------------------------------------
| 3. Cancel Customer Exchange Request
|--------------------------------------------------------------------------
| PATCH /api/v1/exchanges/:exchangeRequestId/cancel
|--------------------------------------------------------------------------
*/

router.patch(
  "/:exchangeRequestId/cancel",
  cancelCustomerExchangeRequestController
);

/*
|--------------------------------------------------------------------------
| 4. Get Exchange Request By ID
|--------------------------------------------------------------------------
| GET /api/v1/exchanges/:exchangeRequestId
|--------------------------------------------------------------------------
*/

router.get(
  "/:exchangeRequestId",
  getCustomerExchangeRequestByIdController
);

export default router;