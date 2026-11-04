import { z } from "zod";

const optionalUrl = z.string().trim().max(500).url().or(z.literal(""));
const policySectionSchema = z.object({
  content: z.string().trim().max(12000),
  isPublished: z.boolean(),
}).strict();
const policiesSchema = z.object({
  cod: policySectionSchema.optional(),
  returns: policySectionSchema.optional(),
  refunds: policySectionSchema.optional(),
  damaged: policySectionSchema.optional(),
  shipping: policySectionSchema.optional(),
  privacy: policySectionSchema.optional(),
  terms: policySectionSchema.optional(),
}).strict();

export const updateStoreSettingsSchema = z.object({
  storeName: z.string().trim().min(1).max(100).optional(),
  supportEmail: z.string().trim().email().max(254).optional(),
  supportPhone: z.string().trim().min(5).max(30).optional(),
  businessAddress: z.string().trim().min(10).max(500).optional(),
  whatsappNumber: z.string().trim().min(8).max(20).optional(),
  whatsappUrl: optionalUrl.optional(),
  instagramUrl: optionalUrl.optional(),
  facebookUrl: optionalUrl.optional(),
  policies: policiesSchema.optional(),
}).strict().refine((data) => Object.keys(data).length > 0, {
  message: "Provide at least one store detail to update.",
});
