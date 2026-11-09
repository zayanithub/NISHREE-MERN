import { Router } from "express";
import { getPublicBlogPost, listPublicBlogPosts } from "../controllers/blogPostController.js";

const router = Router();
router.get("/", listPublicBlogPosts);
router.get("/:slug", getPublicBlogPost);

export default router;
