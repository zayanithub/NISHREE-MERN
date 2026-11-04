import { z } from "zod";

export const contactMessageSchema = z
  .object({
    fullName: z.string().trim().min(2, "Enter your full name.").max(100),
    email: z.string().trim().email("Enter a valid email address.").max(254),
    subject: z.string().trim().min(3, "Enter a subject.").max(150),
    message: z.string().trim().min(10, "Please add a little more detail.").max(3000),
  })
  .strict();
