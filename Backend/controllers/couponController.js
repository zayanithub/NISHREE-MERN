import {
  createAdminCoupon,
  deleteAdminCoupon,
  getAdminCouponById,
  listAdminCoupons,
  listCurrentPublicOffers,
  setAdminCouponStatus,
  updateAdminCoupon,
  validateCouponForCart,
} from "../service/couponService.js";

export const validateCouponController = async (req, res, next) => {
  try {
    const result = await validateCouponForCart(
      req.auth?.userId,
      req.validatedBody.code
    );

    return res.status(200).json({
      success: true,
      message: "Coupon is valid for your cart.",
      data: result,
    });
  } catch (error) {
    return next(error);
  }
};

export const listPublicOffersController = async (req, res, next) => {
  try {
    const offers = await listCurrentPublicOffers();
    return res.status(200).json({
      success: true,
      message: "Current offers retrieved successfully.",
      offers,
    });
  } catch (error) {
    return next(error);
  }
};

export const listAdminCouponsController = async (req, res, next) => {
  try {
    const result = await listAdminCoupons(req.query);
    return res.status(200).json({
      success: true,
      message: "Coupons retrieved successfully.",
      data: result,
    });
  } catch (error) {
    return next(error);
  }
};

export const getAdminCouponController = async (req, res, next) => {
  try {
    const coupon = await getAdminCouponById(req.params.couponId);
    return res.status(200).json({
      success: true,
      message: "Coupon retrieved successfully.",
      data: { coupon },
    });
  } catch (error) {
    return next(error);
  }
};

export const createAdminCouponController = async (req, res, next) => {
  try {
    const coupon = await createAdminCoupon(
      req.admin?.adminId,
      req.validatedBody
    );
    return res.status(201).json({
      success: true,
      message: "Coupon created successfully.",
      data: { coupon },
    });
  } catch (error) {
    return next(error);
  }
};

export const updateAdminCouponController = async (req, res, next) => {
  try {
    const coupon = await updateAdminCoupon(
      req.params.couponId,
      req.validatedBody
    );
    return res.status(200).json({
      success: true,
      message: "Coupon updated successfully.",
      data: { coupon },
    });
  } catch (error) {
    return next(error);
  }
};

export const updateAdminCouponStatusController = async (
  req,
  res,
  next
) => {
  try {
    const coupon = await setAdminCouponStatus(
      req.params.couponId,
      req.validatedBody.isActive
    );
    return res.status(200).json({
      success: true,
      message: `Coupon ${coupon.isActive ? "activated" : "deactivated"} successfully.`,
      data: { coupon },
    });
  } catch (error) {
    return next(error);
  }
};

export const deleteAdminCouponController = async (req, res, next) => {
  try {
    const result = await deleteAdminCoupon(req.params.couponId);
    return res.status(200).json({
      success: true,
      message: "Coupon deleted successfully.",
      data: result,
    });
  } catch (error) {
    return next(error);
  }
};
