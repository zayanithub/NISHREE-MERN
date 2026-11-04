import { Router } from "express";
import {
  addHomepageImages,
  deleteHomepageImage,
  getAdminHomepageImages,
  reorderHomepageImages,
  updateHomepageImage,
} from "../../controllers/homepageImageController.js";
import adminAuthMiddleware from "../../middlewares/adminAuthMiddleware.js";
import requirePermission from "../../middlewares/requirePermission.js";
import {
  replaceHomepageImage,
  uploadHomepageImages,
} from "../../middlewares/homepageImageUpload.js";

const router = Router();

router.use(adminAuthMiddleware);
router.get("/", requirePermission("settings", "read"), getAdminHomepageImages);
router.post(
  "/",
  requirePermission("settings", "update"),
  uploadHomepageImages,
  addHomepageImages
);
router.patch(
  "/reorder",
  requirePermission("settings", "update"),
  reorderHomepageImages
);
router.patch(
  "/:imageId",
  requirePermission("settings", "update"),
  replaceHomepageImage,
  updateHomepageImage
);
router.delete(
  "/:imageId",
  requirePermission("settings", "update"),
  deleteHomepageImage
);

export default router;
