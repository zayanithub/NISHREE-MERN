import { Router } from "express";
import {
  createBlogPost,
  deleteBlogPost,
  getAdminBlogPost,
  listAdminBlogPosts,
  updateBlogPost,
  uploadBlogMedia,
} from "../../controllers/blogPostController.js";
import adminAuthMiddleware from "../../middlewares/adminAuthMiddleware.js";
import requirePermission from "../../middlewares/requirePermission.js";
import { uploadBlogImage } from "../../middlewares/blogImageUpload.js";

const router = Router();
router.use(adminAuthMiddleware);
router.get("/", requirePermission("settings", "read"), listAdminBlogPosts);
router.post("/media", requirePermission("settings", "update"), uploadBlogImage, uploadBlogMedia);
router.post("/", requirePermission("settings", "update"), uploadBlogImage, createBlogPost);
router.get("/:postId", requirePermission("settings", "read"), getAdminBlogPost);
router.patch("/:postId", requirePermission("settings", "update"), uploadBlogImage, updateBlogPost);
router.delete("/:postId", requirePermission("settings", "update"), deleteBlogPost);

export default router;
