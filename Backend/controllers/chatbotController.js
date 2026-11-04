import { answerStoreQuestion } from "../service/chatbotService.js";

export const askStoreChatbotController = async (req, res, next) => {
  try {
    const result = await answerStoreQuestion(req.validatedBody.message);
    return res.status(200).json({ success: true, ...result });
  } catch (error) {
    return next(error);
  }
};
