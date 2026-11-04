import {
  getAdminReviewById,
  listAdminReviews,
  moderateReview,
} from "../service/reviewService.js";

export const listAdminReviewsController = async (
  req,
  res,
  next
) => {
  try {
    const result = await listAdminReviews(req.query);

    return res.status(200).json({
      success: true,
      message: "Reviews retrieved successfully.",
      data: result,
    });
  } catch (error) {
    return next(error);
  }
};

export const getAdminReviewController = async (
  req,
  res,
  next
) => {
  try {
    const review = await getAdminReviewById(req.params.reviewId);

    return res.status(200).json({
      success: true,
      message: "Review retrieved successfully.",
      data: { review },
    });
  } catch (error) {
    return next(error);
  }
};

export const moderateReviewController = async (
  req,
  res,
  next
) => {
  try {
    const review = await moderateReview(
      req.admin?.adminId,
      req.params.reviewId,
      req.validatedBody
    );

    return res.status(200).json({
      success: true,
      message: "Review moderated successfully.",
      data: { review },
    });
  } catch (error) {
    return next(error);
  }
};
