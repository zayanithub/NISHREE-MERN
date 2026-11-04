import { z } from "zod";

export const chatbotAskSchema = z.object({
  message: z.string().trim().min(1, "Enter a question.").max(500, "Keep the question under 500 characters."),
}).strict();
