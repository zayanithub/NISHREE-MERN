import { z } from "zod";

const objectIdSchema = z
  .string()
  .trim()
  .regex(/^[a-f\d]{24}$/i, "Please provide a valid MongoDB ID");

const codeSchema = z
  .string()
  .trim()
  .min(3, "Coupon code must contain at least 3 characters")
  .max(50, "Coupon code cannot exceed 50 characters")
  .regex(
    /^[A-Za-z0-9][A-Za-z0-9_-]*$/,
    "Coupon code may contain letters, numbers, hyphens, and underscores"
  )
  .transform((code) => code.toUpperCase());

const discountFields = {
  code: codeSchema,
  description: z.string().trim().max(500).optional(),
  discountType: z.enum(["percentage", "fixed"]),
  discountValue: z.number().finite().positive(),
  maxDiscount: z.number().finite().positive().nullable().optional(),
  minimumOrderValue: z.number().finite().min(0).optional(),
  startsAt: z.coerce.date(),
  expiresAt: z.coerce.date(),
  usageLimit: z.number().int().positive().nullable().optional(),
  perUserLimit: z.number().int().positive().optional(),
  applicableCategories: z.array(objectIdSchema).max(100).optional(),
  applicableProducts: z.array(objectIdSchema).max(100).optional(),
  isActive: z.boolean().optional(),
};

const validateCouponDates = (data, context) => {
  if (data.startsAt && data.expiresAt && data.expiresAt <= data.startsAt) {
    context.addIssue({
      code: "custom",
      path: ["expiresAt"],
      message: "Expiry must be later than the start time",
    });
  }

  if (
    data.discountType === "percentage" &&
    data.discountValue > 100
  ) {
    context.addIssue({
      code: "custom",
      path: ["discountValue"],
      message: "Percentage discount cannot exceed 100",
    });
  }
};

export const createCouponSchema = z
  .object(discountFields)
  .strict()
  .superRefine(validateCouponDates);

export const updateCouponSchema = z
  .object(discountFields)
  .partial()
  .strict()
  .refine(
    (data) => Object.keys(data).length > 0,
    "Provide at least one coupon field to update"
  )
  .superRefine((data, context) => {
    validateCouponDates(data, context);
  });

export const updateCouponStatusSchema = z
  .object({
    isActive: z.boolean(),
  })
  .strict();

export const validateCouponSchema = z
  .object({ code: codeSchema })
  .strict();
