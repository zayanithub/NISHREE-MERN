import { z } from "zod";
// MongoDB ObjectId validation
const objectIdSchema = z
  .string()
  .trim()
  .regex(
    /^[a-f\d]{24}$/i,
    "Please provide a valid MongoDB ID"
  );

// Category slug validation
const categorySlugSchema = z
  .string()
  .trim()
  .transform((value) => value.toLowerCase())
  .pipe(
    z
      .string()
      .min(1, "Category slug is required")
      .max(120, "Category slug cannot exceed 120 characters")
      .regex(
        /^[a-z0-9]+(?:-[a-z0-9]+)*$/,
        "Slug must contain lowercase letters, numbers, and hyphens only"
      )
  );

const categoryFields = {
  name: z
    .string()
    .trim()
    .min(1, "Category name is required")
    .max(100, "Category name cannot exceed 100 characters"),

  slug: categorySlugSchema,

  description: z
    .string()
    .trim()
    .max(1000, "Description cannot exceed 1000 characters")
    .optional(),

  image: z.object({
    url: z.string().trim().max(2048).url().or(z.literal("")),
  }).strict().optional(),

  parentCategory: objectIdSchema
    .nullable()
    .optional(),

  sortOrder: z
    .number()
    .int("Sort order must be an integer")
    .min(0, "Sort order cannot be negative")
    .optional(),

  isFeatured: z.boolean().optional(),

  seoTitle: z
    .string()
    .trim()
    .max(70, "SEO title cannot exceed 70 characters")
    .optional(),

  seoDescription: z
    .string()
    .trim()
    .max(200, "SEO description cannot exceed 200 characters")
    .optional(),
};
export const createCategorySchema = z
  .object({
    ...categoryFields,

    isActive: z.boolean().optional(),
  })
  .strict();
export const updateCategorySchema = z
  .object(categoryFields)
  .partial()
  .strict()
  .refine(
    (data) => Object.keys(data).length > 0,
    {
      message: "Provide at least one field to update",
    }
  );

export const updateCategoryStatusSchema = z
  .object({
    isActive: z.boolean({
      error: "isActive must be a boolean",
    }),
  })
  .strict();