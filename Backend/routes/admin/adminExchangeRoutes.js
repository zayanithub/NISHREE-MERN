import { Router } from "express";

import {
  listAdminExchangeRequestsController,
  getAdminExchangeRequestByIdController,
  reviewAdminExchangeRequestController,
  settleExchangePriceDifferenceController,
  transitionAdminExchangeRequestController,
} from "../../controllers/adminExchangeController.js";

import adminAuthMiddleware from "../../middlewares/adminAuthMiddleware.js";
import requirePermission from "../../middlewares/requirePermission.js";

const router = Router();

/*
|--------------------------------------------------------------------------
| Admin Exchange Routes
|--------------------------------------------------------------------------
|
| All routes require an authenticated admin.
| Each operation checks the relevant RBAC permission.
|
*/

router.use(adminAuthMiddleware);

/*
|--------------------------------------------------------------------------
| 1. List Exchange Requests
|--------------------------------------------------------------------------
| GET /api/v1/admin/exchanges
| Permission: exchanges.read
|--------------------------------------------------------------------------
*/

router.get(
  "/",
  requirePermission("exchanges", "read"),
  listAdminExchangeRequestsController
);

/*
|--------------------------------------------------------------------------
| 2. Get Exchange Request By ID
|--------------------------------------------------------------------------
| GET /api/v1/admin/exchanges/:exchangeRequestId
| Permission: exchanges.read
|--------------------------------------------------------------------------
*/

router.get(
  "/:exchangeRequestId",
  requirePermission("exchanges", "read"),
  getAdminExchangeRequestByIdController
);

/*
|--------------------------------------------------------------------------
| 3. Review / Approve / Reject Exchange Request
|--------------------------------------------------------------------------
| PATCH /api/v1/admin/exchanges/:exchangeRequestId/review
| Permission: exchanges.update
|--------------------------------------------------------------------------
*/

router.patch(
  "/:exchangeRequestId/review",
  requirePermission("exchanges", "update"),
  reviewAdminExchangeRequestController
);

router.patch(
  "/:exchangeRequestId/price-difference",
  requirePermission("exchanges", "update"),
  settleExchangePriceDifferenceController
);

/*
|--------------------------------------------------------------------------
| 4. Advance Exchange Workflow
|--------------------------------------------------------------------------
| PATCH /api/v1/admin/exchanges/:exchangeRequestId/workflow
| Permission: exchanges.update
|--------------------------------------------------------------------------
*/

router.patch(
  "/:exchangeRequestId/workflow",
  requirePermission("exchanges", "update"),
  transitionAdminExchangeRequestController
);

export default router;