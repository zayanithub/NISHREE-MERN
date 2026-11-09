import { Router } from "express";
import rateLimit from "express-rate-limit";
import { subscribeToNewsletterController } from "../controllers/newsletterController.js";
import validate from "../middlewares/validateMiddleware.js";
import { newsletterSubscriptionSchema } from "../validations/newsletterValidation.js";

const router = Router();
const newsletterLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 5,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  message: {
    success: false,
    message: "Too many subscription requests. Please try again later.",
  },
});

router.post("/", newsletterLimiter, validate(newsletterSubscriptionSchema), subscribeToNewsletterController);

export default router;
