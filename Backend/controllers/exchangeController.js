import {
  createCustomerExchangeRequest,
  listCustomerExchangeRequests,
  getCustomerExchangeRequestById,
  cancelCustomerExchangeRequest,
} from "../service/exchangeService.js";

/*
|--------------------------------------------------------------------------
| Common Controller Error Handler
|--------------------------------------------------------------------------
*/

const handleControllerError = (res, error, context) => {
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
      message: "A duplicate exchange request was detected.",
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
| 1. Create Customer Exchange Request
|--------------------------------------------------------------------------
|
| POST /api/v1/exchanges
|
*/

export const createCustomerExchangeRequestController =
  async (req, res) => {
    try {
      const exchangeRequest =
        await createCustomerExchangeRequest(
          req.auth?.userId,
          req.body
        );

      return res.status(201).json({
        success: true,
        message: "Exchange request created successfully.",
        data: {
          exchangeRequest,
        },
      });
    } catch (error) {
      return handleControllerError(
        res,
        error,
        "Create customer exchange request error"
      );
    }
  };

/*
|--------------------------------------------------------------------------
| 2. List Customer Exchange Requests
|--------------------------------------------------------------------------
|
| GET /api/v1/exchanges
|
| Query parameters:
| page, limit, status
|
*/

export const listCustomerExchangeRequestsController =
  async (req, res) => {
    try {
      const result = await listCustomerExchangeRequests(
        req.auth?.userId,
        req.query
      );

      return res.status(200).json({
        success: true,
        message: "Exchange requests retrieved successfully.",
        data: result,
      });
    } catch (error) {
      return handleControllerError(
        res,
        error,
        "List customer exchange requests error"
      );
    }
  };

/*
|--------------------------------------------------------------------------
| 3. Get Customer Exchange Request By ID
|--------------------------------------------------------------------------
|
| GET /api/v1/exchanges/:exchangeRequestId
|
*/

export const getCustomerExchangeRequestByIdController =
  async (req, res) => {
    try {
      const exchangeRequest =
        await getCustomerExchangeRequestById(
          req.auth?.userId,
          req.params.exchangeRequestId
        );

      return res.status(200).json({
        success: true,
        message: "Exchange request retrieved successfully.",
        data: {
          exchangeRequest,
        },
      });
    } catch (error) {
      return handleControllerError(
        res,
        error,
        "Get customer exchange request error"
      );
    }
  };

/*
|--------------------------------------------------------------------------
| 4. Cancel Customer Exchange Request
|--------------------------------------------------------------------------
|
| PATCH /api/v1/exchanges/:exchangeRequestId/cancel
|
*/

export const cancelCustomerExchangeRequestController =
  async (req, res) => {
    try {
      const exchangeRequest =
        await cancelCustomerExchangeRequest(
          req.auth?.userId,
          req.params.exchangeRequestId
        );

      return res.status(200).json({
        success: true,
        message: "Exchange request cancelled successfully.",
        data: {
          exchangeRequest,
        },
      });
    } catch (error) {
      return handleControllerError(
        res,
        error,
        "Cancel customer exchange request error"
      );
    }
  };