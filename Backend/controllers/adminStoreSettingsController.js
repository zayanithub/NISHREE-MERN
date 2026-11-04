import { getAdminStoreDetails, updateStoreDetails } from "../service/storeSettingsService.js";

export const getAdminStoreSettingsController = async (_req, res, next) => {
  try {
    const settings = await getAdminStoreDetails();
    return res.status(200).json({ success: true, settings });
  } catch (error) {
    return next(error);
  }
};

export const updateAdminStoreSettingsController = async (req, res, next) => {
  try {
    const settings = await updateStoreDetails(req.validatedBody, req.admin.adminId);
    return res.status(200).json({ success: true, message: "Store details saved.", settings });
  } catch (error) {
    return next(error);
  }
};
