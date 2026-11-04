import { z } from "zod";

export const notificationPreferenceSchema = z
  .object({
    inAppNotifications: z.boolean().optional(),
    orderUpdates: z.boolean().optional(),
    paymentUpdates: z.boolean().optional(),
    shippingUpdates: z.boolean().optional(),
    returnUpdates: z.boolean().optional(),
    exchangeUpdates: z.boolean().optional(),
    refundUpdates: z.boolean().optional(),
    systemUpdates: z.boolean().optional(),
    promotionalInApp: z.boolean().optional(),
    promotionalEmail: z.boolean().optional(),
    promotionalSms: z.boolean().optional(),
    promotionalWhatsapp: z.boolean().optional(),
    emailNotifications: z.boolean().optional(),
    smsNotifications: z.boolean().optional(),
    whatsappNotifications: z.boolean().optional(),
  })
  .strict()
  .refine(
    (preferences) => Object.keys(preferences).length > 0,
    "Provide at least one notification preference"
  );

export const notificationTemplateSchema = z
  .object({
    name: z.string().trim().min(1).max(120),
    subject: z.string().trim().max(200).optional(),
    body: z.string().min(1).max(5000),
    variables: z.array(z.string().regex(/^[a-zA-Z][a-zA-Z0-9_]*$/)).max(30),
    isActive: z.boolean().optional(),
  })
  .strict();

export const notificationRetrySchema = z
  .object({
    confirmUnknownOutcome: z.boolean().default(false),
  })
  .strict()
  .default({});

export const notificationOutboxQuerySchema = z
  .object({
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(25),
    status: z
      .enum(["pending", "processing", "completed", "failed"])
      .optional(),
  })
  .strict();
