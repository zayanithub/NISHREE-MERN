import { getPublicStoreDetails } from "../service/storeSettingsService.js";

export const getPublicStoreSettingsController = async (_req, res, next) => {
  try {
    const settings = await getPublicStoreDetails();
    return res.status(200).json({ success: true, settings });
  } catch (error) {
    return next(error);
  }
};
