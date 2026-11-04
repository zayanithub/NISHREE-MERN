
import { z } from "zod";

export const adminLoginSchema = z
  .object({
    email: z
      .string()
      .trim()
      .email("Enter a valid email address")
      .max(254)
      .transform((value) => value.toLowerCase()),

    password: z
      .string()
      .min(1, "Password is required")
      .max(72, "Password is too long"),
  })
  .strict();

export const adminOtpChallengeSchema = z
  .object({
    challengeId: z.string().regex(/^[a-f\d]{24}$/i, "Invalid verification request"),
    otp: z.string().regex(/^\d{6}$/, "Enter the six-digit verification code"),
  })
  .strict();

export const adminOtpResendSchema = z
  .object({
    challengeId: z.string().regex(/^[a-f\d]{24}$/i, "Invalid verification request"),
  })
  .strict();
