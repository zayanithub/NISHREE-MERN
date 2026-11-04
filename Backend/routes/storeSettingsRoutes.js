import { Router } from "express";
import { getPublicStoreSettingsController } from "../controllers/storeSettingsController.js";

const router = Router();
router.get("/", getPublicStoreSettingsController);
export default router;
