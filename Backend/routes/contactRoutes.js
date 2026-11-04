import { Router } from "express";
import rateLimit from "express-rate-limit";
import { submitContactMessageController } from "../controllers/contactController.js";
import validate from "../middlewares/validateMiddleware.js";
import { contactMessageSchema } from "../validations/contactValidation.js";

const router = Router();
const contactLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 5,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  message: {
    success: false,
    message: "Too many contact requests. Please try again later.",
  },
});

router.post("/", contactLimiter, validate(contactMessageSchema), submitContactMessageController);

export default router;
