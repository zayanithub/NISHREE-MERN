import { z } from "zod";

export const newsletterSubscriptionSchema = z
  .object({
    email: z.string().trim().email("Enter a valid email address.").max(254),
    consent: z.literal(true, {
      error: "Please consent to receive email updates.",
    }),
  })
  .strict();
