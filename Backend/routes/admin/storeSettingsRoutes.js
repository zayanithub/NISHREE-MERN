import { Router } from "express";
import { getAdminStoreSettingsController, updateAdminStoreSettingsController } from "../../controllers/adminStoreSettingsController.js";
import adminAuthMiddleware from "../../middlewares/adminAuthMiddleware.js";
import requirePermission from "../../middlewares/requirePermission.js";
import validate from "../../middlewares/validateMiddleware.js";
import { updateStoreSettingsSchema } from "../../validations/storeSettingsValidation.js";

const router = Router();
router.use(adminAuthMiddleware);
router.get("/", requirePermission("settings", "read"), getAdminStoreSettingsController);
router.patch("/", requirePermission("settings", "update"), validate(updateStoreSettingsSchema), updateAdminStoreSettingsController);
export default router;
