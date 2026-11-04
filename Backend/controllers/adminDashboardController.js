import {
  getAdminDashboardInventoryAlerts,
  getAdminDashboardOverview,
  getAdminDashboardSales,
} from "../service/adminDashboardService.js";

export const getAdminDashboardOverviewController = async (
  req,
  res,
  next
) => {
  try {
    const data = await getAdminDashboardOverview(req.query);
    return res.status(200).json({
      success: true,
      message: "Admin dashboard overview retrieved successfully.",
      data,
    });
  } catch (error) {
    return next(error);
  }
};

export const getAdminDashboardSalesController = async (
  req,
  res,
  next
) => {
  try {
    const data = await getAdminDashboardSales(req.query);
    return res.status(200).json({
      success: true,
      message: "Admin dashboard sales retrieved successfully.",
      data,
    });
  } catch (error) {
    return next(error);
  }
};

export const getAdminDashboardInventoryController = async (
  req,
  res,
  next
) => {
  try {
    const data = await getAdminDashboardInventoryAlerts(req.query);
    return res.status(200).json({
      success: true,
      message: "Admin inventory alerts retrieved successfully.",
      data,
    });
  } catch (error) {
    return next(error);
  }
};
