import {
  createCustomerReview,
  deleteCustomerReview,
  listCustomerReviews,
  listPublicProductReviews,
  updateCustomerReview,
} from "../service/reviewService.js";

export const createCustomerReviewController = async (
  req,
  res,
  next
) => {
  try {
    const review = await createCustomerReview(
      req.auth?.userId,
      req.params.productId,
      req.validatedBody
    );

    return res.status(201).json({
      success: true,
      message: "Review submitted for moderation.",
      data: { review },
    });
  } catch (error) {
    return next(error);
  }
};

export const listCustomerReviewsController = async (
  req,
  res,
  next
) => {
  try {
    const result = await listCustomerReviews(
      req.auth?.userId,
      req.query
    );

    return res.status(200).json({
      success: true,
      message: "Your reviews were retrieved successfully.",
      data: result,
    });
  } catch (error) {
    return next(error);
  }
};

export const updateCustomerReviewController = async (
  req,
  res,
  next
) => {
  try {
    const review = await updateCustomerReview(
      req.auth?.userId,
      req.params.reviewId,
      req.validatedBody
    );

    return res.status(200).json({
      success: true,
      message: "Review updated and submitted for moderation.",
      data: { review },
    });
  } catch (error) {
    return next(error);
  }
};

export const deleteCustomerReviewController = async (
  req,
  res,
  next
) => {
  try {
    const result = await deleteCustomerReview(
      req.auth?.userId,
      req.params.reviewId
    );

    return res.status(200).json({
      success: true,
      message: "Review deleted successfully.",
      data: result,
    });
  } catch (error) {
    return next(error);
  }
};

export const listPublicProductReviewsController = async (
  req,
  res,
  next
) => {
  try {
    const result = await listPublicProductReviews(
      req.params.slug,
      req.query
    );

    return res.status(200).json({
      success: true,
      message: "Product reviews retrieved successfully.",
      data: result,
    });
  } catch (error) {
    return next(error);
  }
};
