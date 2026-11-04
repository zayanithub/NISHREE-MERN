import { Router } from "express";
import rateLimit from "express-rate-limit";
import validate from "../middlewares/validateMiddleware.js";
import { chatbotAskSchema } from "../validations/chatbotValidation.js";
import { askStoreChatbotController } from "../controllers/chatbotController.js";

const router = Router();
const chatbotLimiter = rateLimit({
  windowMs: 5 * 60 * 1000,
  limit: 15,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  message: { success: false, message: "Please wait a moment before asking another question." },
});

router.post("/ask", chatbotLimiter, validate(chatbotAskSchema), askStoreChatbotController);
export default router;
