import { Router } from "express";

import {
  createRefundForReturnController,
  approveRefundController,
  rejectRefundController,
  processApprovedRefundController,
  getAdminRefundByIdController,
  listAdminRefundsController,
} from "../../controllers/refundController.js";

import adminAuthMiddleware from "../../middlewares/adminAuthMiddleware.js";
import requirePermission from "../../middlewares/requirePermission.js";

const router = Router();

/*
|--------------------------------------------------------------------------
| Admin Refund Routes
|--------------------------------------------------------------------------
|
| All endpoints require an authenticated admin and the
| appropriate refund permission.
|
*/

router.use(adminAuthMiddleware);

router.get(
  "/",
  requirePermission("refunds", "read"),
  listAdminRefundsController
);

/*
|--------------------------------------------------------------------------
| 1. Create Refund For An Eligible Return
|--------------------------------------------------------------------------
| POST /api/v1/admin/refunds/returns/:returnRequestId
| Permission: refunds.create
|--------------------------------------------------------------------------
*/

router.post(
  "/returns/:returnRequestId",
  requirePermission("refunds", "create"),
  createRefundForReturnController
);

/*
|--------------------------------------------------------------------------
| 2. Get Refund Details
|--------------------------------------------------------------------------
| GET /api/v1/admin/refunds/:refundId
| Permission: refunds.read
|--------------------------------------------------------------------------
*/

router.get(
  "/:refundId",
  requirePermission("refunds", "read"),
  getAdminRefundByIdController
);

/*
|--------------------------------------------------------------------------
| 3. Approve Refund
|--------------------------------------------------------------------------
| PATCH /api/v1/admin/refunds/:refundId/approve
| Permission: refunds.update
|--------------------------------------------------------------------------
*/

router.patch(
  "/:refundId/approve",
  requirePermission("refunds", "update"),
  approveRefundController
);

/*
| Reject a requested refund with a required explanation.
| PATCH /api/v1/admin/refunds/:refundId/reject
*/
router.patch(
  "/:refundId/reject",
  requirePermission("refunds", "update"),
  rejectRefundController
);

/*
|--------------------------------------------------------------------------
| 4. Process Approved Refund
|--------------------------------------------------------------------------
| POST /api/v1/admin/refunds/:refundId/process
| Permission: refunds.update
|
| Razorpay refunds are submitted to the payment gateway.
| For a manual refund, call once to claim the approved payout,
| make the payout outside the system, then call again with
| { "method": "bank_transfer|upi|cash|other", "reference": "..." }.
| If the payout fails, submit { "failureReason": "..." } instead.
|--------------------------------------------------------------------------
*/

router.post(
  "/:refundId/process",
  requirePermission("refunds", "update"),
  processApprovedRefundController
);

export default router;