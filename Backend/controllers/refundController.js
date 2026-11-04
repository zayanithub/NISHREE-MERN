import {
  createRefundForReturnRequest,
  approveRefund,
  rejectRefund,
  processApprovedRefund,
  getAdminRefundById,
  listAdminRefunds,
} from "../service/refundService.js";

/*
|--------------------------------------------------------------------------
| Common Controller Error Handler
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
      message: "A duplicate refund operation was detected.",
    });
  }

  console.error(`${context}:`, error);

  return res.status(500).json({
    success: false,
    message: "An internal server error occurred.",
  });
};

export const listAdminRefundsController = async (
  req,
  res
) => {
  try {
    const result = await listAdminRefunds({
      page: req.query.page,
      limit: req.query.limit,
      status: req.query.status,
      refundMethod: req.query.refundMethod,
      orderId: req.query.orderId,
    });

    return res.status(200).json({
      success: true,
      message: "Refunds retrieved successfully.",
      data: result,
    });
  } catch (error) {
    return handleControllerError(
      res,
      error,
      "List admin refunds error"
    );
  }
};

/*
|--------------------------------------------------------------------------
| 1. Create Refund For An Eligible Return
|--------------------------------------------------------------------------
| POST /api/v1/admin/refunds/returns/:returnRequestId
|
| The linked return must be in refund_pending status.
| The refund amount is calculated by the server.
| The request body must not contain a client-supplied amount.
|--------------------------------------------------------------------------
*/

export const createRefundForReturnController = async (
  req,
  res
) => {
  try {
    const refund = await createRefundForReturnRequest(
      req.admin?.adminId,
      req.params.returnRequestId
    );

    return res.status(201).json({
      success: true,
      message: "Refund request created successfully.",
      data: {
        refund,
      },
    });
  } catch (error) {
    return handleControllerError(
      res,
      error,
      "Create refund request error"
    );
  }
};

/*
|--------------------------------------------------------------------------
| 2. Approve Refund Request
|--------------------------------------------------------------------------
| PATCH /api/v1/admin/refunds/:refundId/approve
|
| Only a requested refund can be approved.
|--------------------------------------------------------------------------
*/

export const approveRefundController = async (
  req,
  res
) => {
  try {
    const refund = await approveRefund(
      req.admin?.adminId,
      req.params.refundId
    );

    return res.status(200).json({
      success: true,
      message: "Refund approved successfully.",
      data: {
        refund,
      },
    });
  } catch (error) {
    return handleControllerError(
      res,
      error,
      "Approve refund error"
    );
  }
};

export const rejectRefundController = async (req, res) => {
  try {
    const refund = await rejectRefund(
      req.admin?.adminId,
      req.params.refundId,
      req.body
    );

    return res.status(200).json({
      success: true,
      message: "Refund request rejected successfully.",
      data: { refund },
    });
  } catch (error) {
    return handleControllerError(res, error, "Reject refund error");
  }
};

/*
|--------------------------------------------------------------------------
| 3. Process Approved Refund
|--------------------------------------------------------------------------
| POST /api/v1/admin/refunds/:refundId/process
|
| This operation can initiate a real Razorpay refund.
| Call only after verifying the refund and order.
|--------------------------------------------------------------------------
*/

export const processApprovedRefundController = async (
  req,
  res
) => {
  try {
    const refund = await processApprovedRefund(
      req.admin?.adminId,
      req.params.refundId,
      req.body
    );

    const statusCode =
      refund.status === "processed" ? 200 : 202;

    return res.status(statusCode).json({
      success: true,
      message:
        refund.status === "processed"
          ? "Refund processed successfully."
          : refund.refundMethod === "manual"
            ? "Manual refund authorized. Complete the payout externally, then submit its method and reference to record completion."
            : "Refund submitted or awaiting gateway reconciliation.",
      data: {
        refund,
      },
    });
  } catch (error) {
    return handleControllerError(
      res,
      error,
      "Process refund error"
    );
  }
};

/*
|--------------------------------------------------------------------------
| 4. Get Refund Details
|--------------------------------------------------------------------------
| GET /api/v1/admin/refunds/:refundId
|--------------------------------------------------------------------------
*/

export const getAdminRefundByIdController = async (
  req,
  res
) => {
  try {
    const refund = await getAdminRefundById(
      req.params.refundId
    );

    return res.status(200).json({
      success: true,
      message: "Refund retrieved successfully.",
      data: {
        refund,
      },
    });
  } catch (error) {
    return handleControllerError(
      res,
      error,
      "Get admin refund error"
    );
  }
};