import { z } from "zod";

export const registerSchema = z.object({
  name: z.string().trim().min(2).max(100),
  email: z.string().trim().email().max(254).transform((v) => v.toLowerCase()),
  phone: z.string().trim().max(20).optional(),
  password: z.string().min(8).max(72),
});

export const loginSchema = z.object({
  email: z.string().trim().email().max(254).transform((v) => v.toLowerCase()),
  password: z.string().min(1).max(72),
});

export const otpChallengeSchema = z.object({
  challengeId: z.string().regex(/^[a-f\d]{24}$/i),
  otp: z.string().regex(/^\d{6}$/),
});

export const otpResendSchema = z.object({
  challengeId: z.string().regex(/^[a-f\d]{24}$/i),
});

export const forgotPasswordSchema = z.object({
  email: z.string().trim().email().max(254).transform((v) => v.toLowerCase()),
});

export const resetPasswordSchema = z.object({
  resetToken: z.string().regex(/^[a-f\d]{64}$/i),
  password: z.string().min(8).max(72),
});