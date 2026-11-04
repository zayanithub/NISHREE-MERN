import {
  createCustomerReturnRequest,
  listCustomerReturnRequests,
  getCustomerReturnRequestById,
  cancelCustomerReturnRequest,
} from "../service/returnService.js";

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
| 1. Create Customer Return Request
|--------------------------------------------------------------------------
| POST /api/v1/returns
|--------------------------------------------------------------------------
*/

export const createCustomerReturnRequestController = async (
  req,
  res
) => {
  try {
    const returnRequest =
      await createCustomerReturnRequest(
        req.auth?.userId,
        req.body
      );

    return res.status(201).json({
      success: true,
      message: "Return request created successfully.",
      data: {
        returnRequest,
      },
    });
  } catch (error) {
    return handleControllerError(
      res,
      error,
      "Create return request error"
    );
  }
};

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

export const listCustomerReturnRequestsController = async (
  req,
  res
) => {
  try {
    const result = await listCustomerReturnRequests(
      req.auth?.userId,
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
      "List customer return requests error"
    );
  }
};

/*
|--------------------------------------------------------------------------
| 3. Get Customer Return Request By ID
|--------------------------------------------------------------------------
| GET /api/v1/returns/:returnRequestId
|--------------------------------------------------------------------------
*/

export const getCustomerReturnRequestByIdController = async (
  req,
  res
) => {
  try {
    const returnRequest =
      await getCustomerReturnRequestById(
        req.auth?.userId,
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
      "Get customer return request error"
    );
  }
};

/*
|--------------------------------------------------------------------------
| 4. Cancel Customer Return Request
|--------------------------------------------------------------------------
| PATCH /api/v1/returns/:returnRequestId/cancel
|--------------------------------------------------------------------------
*/

export const cancelCustomerReturnRequestController = async (
  req,
  res
) => {
  try {
    const returnRequest =
      await cancelCustomerReturnRequest(
        req.auth?.userId,
        req.params.returnRequestId
      );

    return res.status(200).json({
      success: true,
      message: "Return request cancelled successfully.",
      data: {
        returnRequest,
      },
    });
  } catch (error) {
    return handleControllerError(
      res,
      error,
      "Cancel customer return request error"
    );
  }
};