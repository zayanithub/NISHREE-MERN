import { Router } from "express";

import {
  listAdminReturnRequestsController,
  getAdminReturnRequestByIdController,
  reviewAdminReturnRequestController,
  transitionAdminReturnRequestController,
} from "../../controllers/adminReturnController.js";

import adminAuthMiddleware from "../../middlewares/adminAuthMiddleware.js";
import requirePermission from "../../middlewares/requirePermission.js";

const router = Router();

/*
|--------------------------------------------------------------------------
| Admin Return Routes
|--------------------------------------------------------------------------
|
| All routes require an authenticated admin.
| Each operation also checks the required RBAC permission.
|
*/

router.use(adminAuthMiddleware);

/*
|--------------------------------------------------------------------------
| 1. List Return Requests
|--------------------------------------------------------------------------
| GET /api/v1/admin/returns
| Permission: returns.read
|--------------------------------------------------------------------------
*/

router.get(
  "/",
  requirePermission("returns", "read"),
  listAdminReturnRequestsController
);

/*
|--------------------------------------------------------------------------
| 2. Get Return Request By ID
|--------------------------------------------------------------------------
| GET /api/v1/admin/returns/:returnRequestId
| Permission: returns.read
|--------------------------------------------------------------------------
*/

router.get(
  "/:returnRequestId",
  requirePermission("returns", "read"),
  getAdminReturnRequestByIdController
);

/*
|--------------------------------------------------------------------------
| 3. Review / Approve / Reject Return Request
|--------------------------------------------------------------------------
| PATCH /api/v1/admin/returns/:returnRequestId/review
| Permission: returns.update
|--------------------------------------------------------------------------
*/

router.patch(
  "/:returnRequestId/review",
  requirePermission("returns", "update"),
  reviewAdminReturnRequestController
);

/*
|--------------------------------------------------------------------------
| Advance Return Pickup and Inspection Workflow
|--------------------------------------------------------------------------
| PATCH /api/v1/admin/returns/:returnRequestId/workflow
| Permission: returns.update
|--------------------------------------------------------------------------
*/

router.patch(
  "/:returnRequestId/workflow",
  requirePermission("returns", "update"),
  transitionAdminReturnRequestController
);

export default router;