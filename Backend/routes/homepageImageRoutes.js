import { Router } from "express";
import { getPublicHomepageImages } from "../controllers/homepageImageController.js";

const router = Router();

router.get("/", getPublicHomepageImages);

export default router;
