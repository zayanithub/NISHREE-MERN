import {
  listAdminReturnRequests,
  getAdminReturnRequestById,
  reviewAdminReturnRequest,
  transitionAdminReturnRequest,
} from "../service/adminReturnService.js";

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
      message: "A duplicate return request was detected.",
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
| 1. List Return Requests — Admin
|--------------------------------------------------------------------------
| GET /api/v1/admin/returns
|
| Query parameters:
| page, limit, status, search
|--------------------------------------------------------------------------
*/

export const listAdminReturnRequestsController = async (
  req,
  res
) => {
  try {
    const result = await listAdminReturnRequests(
      req.query
    );

    return res.status(200).json({
      success: true,
      message: "Return requests retrieved successfully.",
      data: result,
    });
  } catch (error) {
    return handleControllerError(
      res,
      error,
      "List admin return requests error"
    );
  }
};

/*
|--------------------------------------------------------------------------
| 2. Get One Return Request — Admin
|--------------------------------------------------------------------------
| GET /api/v1/admin/returns/:returnRequestId
|--------------------------------------------------------------------------
*/

export const getAdminReturnRequestByIdController = async (
  req,
  res
) => {
  try {
    const returnRequest =
      await getAdminReturnRequestById(
        req.params.returnRequestId
      );

    return res.status(200).json({
      success: true,
      message: "Return request retrieved successfully.",
      data: {
        returnRequest,
      },
    });
  } catch (error) {
    return handleControllerError(
      res,
      error,
      "Get admin return request error"
    );
  }
};

/*
|--------------------------------------------------------------------------
| 3. Review / Approve / Reject Return Request — Admin
|--------------------------------------------------------------------------
| PATCH /api/v1/admin/returns/:returnRequestId/review
|
| Move to review:
| { "decision": "under_review" }
|
| Approve:
| { "decision": "approve" }
|
| Reject:
| {
|   "decision": "reject",
|   "rejectionReason": "Reason for rejection"
| }
|--------------------------------------------------------------------------
*/

export const reviewAdminReturnRequestController = async (
  req,
  res
) => {
  try {
    const returnRequest =
      await reviewAdminReturnRequest(
        req.admin?.adminId,
        req.params.returnRequestId,
        req.body
      );

    return res.status(200).json({
      success: true,
      message: "Return request reviewed successfully.",
      data: {
        returnRequest,
      },
    });
  } catch (error) {
    return handleControllerError(
      res,
      error,
      "Review admin return request error"
    );
  }
};

/*
|--------------------------------------------------------------------------
| Advance Return Pickup and Inspection Workflow
|--------------------------------------------------------------------------
| PATCH /api/v1/admin/returns/:returnRequestId/workflow
|--------------------------------------------------------------------------
*/

export const transitionAdminReturnRequestController = async (
  req,
  res
) => {
  try {
    const returnRequest =
      await transitionAdminReturnRequest(
        req.admin?.adminId,
        req.params.returnRequestId,
        req.body
      );

    return res.status(200).json({
      success: true,
      message: "Return workflow updated successfully.",
      data: {
        returnRequest,
      },
    });
  } catch (error) {
    return handleControllerError(
      res,
      error,
      "Advance admin return workflow error"
    );
  }
};