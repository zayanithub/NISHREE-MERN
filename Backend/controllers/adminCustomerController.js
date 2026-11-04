import { getAdminCustomer, listAdminCustomers } from "../service/adminCustomerService.js";

export const listAdminCustomersController = async (req, res, next) => {
  try {
    const result = await listAdminCustomers(req.query);
    return res.status(200).json({ success: true, ...result });
  } catch (error) {
    return next(error);
  }
};

export const getAdminCustomerController = async (req, res, next) => {
  try {
    const result = await getAdminCustomer(req.params.customerId);
    return res.status(200).json({ success: true, ...result });
  } catch (error) {
    return next(error);
  }
};
