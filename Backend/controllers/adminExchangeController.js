import {
  listAdminExchangeRequests,
  getAdminExchangeRequestById,
  reviewAdminExchangeRequest,
  settleExchangePriceDifference,
  transitionAdminExchangeRequest,
} from "../service/adminExchangeService.js";

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
| 1. List Admin Exchange Requests
|--------------------------------------------------------------------------
|
| GET /api/v1/admin/exchanges
|
| Query parameters:
| page, limit, status
|
*/

export const listAdminExchangeRequestsController =
  async (req, res) => {
    try {
      const result = await listAdminExchangeRequests(
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
        "List admin exchange requests error"
      );
    }
  };

/*
|--------------------------------------------------------------------------
| 2. Get Admin Exchange Request By ID
|--------------------------------------------------------------------------
|
| GET /api/v1/admin/exchanges/:exchangeRequestId
|
*/

export const getAdminExchangeRequestByIdController =
  async (req, res) => {
    try {
      const exchangeRequest =
        await getAdminExchangeRequestById(
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
        "Get admin exchange request error"
      );
    }
  };

/*
|--------------------------------------------------------------------------
| 3. Review Exchange Request
|--------------------------------------------------------------------------
|
| PATCH /api/v1/admin/exchanges/:exchangeRequestId/review
|
| Accepted statuses:
| approved, rejected
|
*/

export const reviewAdminExchangeRequestController =
  async (req, res) => {
    try {
      const exchangeRequest =
        await reviewAdminExchangeRequest(
          req.params.exchangeRequestId,
          req.admin?.adminId,
          req.body
        );

      return res.status(200).json({
        success: true,
        message: "Exchange request reviewed successfully.",
        data: {
          exchangeRequest,
        },
      });
    } catch (error) {
      return handleControllerError(
        res,
        error,
        "Review admin exchange request error"
      );
    }
  };

export const settleExchangePriceDifferenceController =
  async (req, res) => {
    try {
      const exchangeRequest =
        await settleExchangePriceDifference(
          req.params.exchangeRequestId,
          req.admin?.adminId,
          req.body
        );

      return res.status(200).json({
        success: true,
        message: "Exchange price difference settled successfully.",
        data: {
          exchangeRequest,
        },
      });
    } catch (error) {
      return handleControllerError(
        res,
        error,
        "Settle exchange price difference error"
      );
    }
  };

/*
|--------------------------------------------------------------------------
| 4. Advance Exchange Workflow
|--------------------------------------------------------------------------
|
| PATCH /api/v1/admin/exchanges/:exchangeRequestId/workflow
|
*/

export const transitionAdminExchangeRequestController =
  async (req, res) => {
    try {
      const exchangeRequest =
        await transitionAdminExchangeRequest(
          req.params.exchangeRequestId,
          req.body
        );

      return res.status(200).json({
        success: true,
        message: "Exchange workflow updated successfully.",
        data: {
          exchangeRequest,
        },
      });
    } catch (error) {
      return handleControllerError(
        res,
        error,
        "Transition admin exchange request error"
      );
    }
  };