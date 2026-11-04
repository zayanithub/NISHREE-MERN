import { Router } from "express";

import {
  createCustomerReturnRequestController,
  listCustomerReturnRequestsController,
  getCustomerReturnRequestByIdController,
  cancelCustomerReturnRequestController,
} from "../controllers/returnController.js";
import { uploadCustomerReturnEvidence } from "../controllers/returnEvidenceController.js";
import { uploadReturnEvidence } from "../middlewares/returnEvidenceUpload.js";

import authMiddleware from "../middlewares/authMiddleware.js";

const router = Router();

/*
|--------------------------------------------------------------------------
| Customer Return Routes
|--------------------------------------------------------------------------
|
| All endpoints require a valid customer JWT.
| The customer ID comes from req.auth.userId.
|
*/

router.use(authMiddleware);

router.post(
  "/evidence",
  uploadReturnEvidence,
  uploadCustomerReturnEvidence
);

/*
|--------------------------------------------------------------------------
| 1. Create Return Request
|--------------------------------------------------------------------------
| POST /api/v1/returns
|--------------------------------------------------------------------------
*/

router.post(
  "/",
  createCustomerReturnRequestController
);

/*
|--------------------------------------------------------------------------
| 2. List Customer Return Requests
|--------------------------------------------------------------------------
| GET /api/v1/returns
|
| Query parameters:
| page, limit, status
|--------------------------------------------------------------------------
*/

router.get(
  "/",
  listCustomerReturnRequestsController
);

/*
|--------------------------------------------------------------------------
| 3. Cancel Customer Return Request
|--------------------------------------------------------------------------
| PATCH /api/v1/returns/:returnRequestId/cancel
|--------------------------------------------------------------------------
*/

router.patch(
  "/:returnRequestId/cancel",
  cancelCustomerReturnRequestController
);

/*
|--------------------------------------------------------------------------
| 4. Get Return Request By ID
|--------------------------------------------------------------------------
| GET /api/v1/returns/:returnRequestId
|--------------------------------------------------------------------------
*/

router.get(
  "/:returnRequestId",
  getCustomerReturnRequestByIdController
);

export default router;