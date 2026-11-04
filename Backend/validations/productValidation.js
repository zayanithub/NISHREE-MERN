import { z } from "zod";

/*
|--------------------------------------------------------------------------
| Common Validation Rules
|--------------------------------------------------------------------------
*/

// MongoDB ObjectId
const objectIdSchema = z
  .string()
  .trim()
  .regex(
    /^[a-f\d]{24}$/i,
    "Please provide a valid MongoDB ID"
  );

// Product slug
const productSlugSchema = z
  .string()
  .trim()
  .transform((value) => value.toLowerCase())
  .pipe(
    z
      .string()
      .max(220, "Product slug cannot exceed 220 characters")
      .regex(
        /^(?:[a-z0-9]+(?:-[a-z0-9]+)*)?$/,
        "Slug must contain lowercase letters, numbers, and hyphens only"
      )
  );

// Product SKU
const productSkuSchema = z
  .string()
  .trim()
  .transform((value) => value.toUpperCase())
  .pipe(
    z
      .string()
      .max(100, "SKU cannot exceed 100 characters")
      .regex(
      /^(?:[A-Z0-9]+(?:[-_][A-Z0-9]+)*)?$/,
      "SKU can contain letters, numbers, hyphens, and underscores"
    )
  );

// Price
const priceSchema = z
  .number()
  .finite("Price must be a valid number")
  .min(0, "Price cannot be negative");

// Tags
const tagsSchema = z
  .array(
    z
      .string()
      .trim()
      .min(1, "Tag cannot be empty")
      .max(50, "Each tag cannot exceed 50 characters")
      .transform((value) => value.toLowerCase())
  )
  .max(30, "A product cannot have more than 30 tags");

// Occasions
const occasionSchema = z
  .array(
    z
      .string()
      .trim()
      .min(1, "Occasion cannot be empty")
      .max(50, "Each occasion cannot exceed 50 characters")
  )
  .max(20, "Too many occasions provided");

/*
|--------------------------------------------------------------------------
| Product Fields
|--------------------------------------------------------------------------
| These fields are accepted from the admin request.
|
| primaryImage, variants, createdBy and updatedBy are intentionally
| excluded. They will be managed by trusted backend operations.
|--------------------------------------------------------------------------
*/

const productFields = {
  name: z
    .string()
    .trim()
    .max(200, "Product name cannot exceed 200 characters")
    .optional(),

  slug: productSlugSchema.optional(),

  sku: productSkuSchema.optional(),

  description: z
    .string()
    .trim()
    .max(10000, "Description cannot exceed 10000 characters")
    .optional(),

  shortDescription: z
    .string()
    .trim()
    .max(500, "Short description cannot exceed 500 characters")
    .optional(),

  category: objectIdSchema.nullable().optional(),

  brand: z
    .string()
    .trim()
    .max(100, "Brand cannot exceed 100 characters")
    .optional(),

  material: z
    .string()
    .trim()
    .max(100, "Material cannot exceed 100 characters")
    .optional(),

  color: z
    .string()
    .trim()
    .max(50, "Colour cannot exceed 50 characters")
    .optional(),

  sareeLength: z
    .string()
    .trim()
    .max(50, "Saree length cannot exceed 50 characters")
    .optional(),

  blouseIncluded: z.boolean().optional(),

  blouseType: z
    .enum(["unstitched", "stitched", "none"])
    .optional(),

  basePrice: priceSchema.optional(),

  salePrice: priceSchema
    .nullable()
    .optional(),

  currency: z
    .literal("INR")
    .optional(),

  imageAltText: z
    .string()
    .trim()
    .max(200, "Image alternative text cannot exceed 200 characters")
    .optional(),

  imageCredit: z
    .string()
    .trim()
    .max(300, "Image credit cannot exceed 300 characters")
    .optional(),

  imageLicense: z
    .string()
    .trim()
    .max(100, "Image license cannot exceed 100 characters")
    .optional(),

  imageSourceUrl: z
    .union([z.string().trim().url().max(500), z.literal("")])
    .optional(),

  tags: tagsSchema.optional(),

  fabricCare: z
    .string()
    .trim()
    .max(1000, "Fabric care instructions cannot exceed 1000 characters")
    .optional(),

  occasion: occasionSchema.optional(),

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

/*
|--------------------------------------------------------------------------
| Create Product Validation
|--------------------------------------------------------------------------
| POST /api/v1/admin/products
|--------------------------------------------------------------------------
*/

export const createProductSchema = z
  .object({
    ...productFields,

    status: z
      .enum(["draft", "active", "archived"])
      .optional(),
  })
  .strict()
  .superRefine((data, ctx) => {
    // Sale price cannot exceed base price.
    if (
      data.salePrice != null &&
      data.basePrice !== undefined &&
      data.salePrice > data.basePrice
    ) {
      ctx.addIssue({
        code: "custom",
        path: ["salePrice"],
        message: "Sale price cannot exceed base price",
      });
    }
  });

/*
|--------------------------------------------------------------------------
| Update Product Validation
|--------------------------------------------------------------------------
| PATCH /api/v1/admin/products/:productId
|
| At least one editable field must be supplied.
| Product status is managed through a separate endpoint.
|--------------------------------------------------------------------------
*/

export const updateProductSchema = z
  .object(productFields)
  .partial()
  .strict()
  .superRefine((data, ctx) => {
    if (Object.keys(data).length === 0) {
      ctx.addIssue({
        code: "custom",
        message: "Provide at least one field to update",
      });
    }

    // Validate the price relationship when both are provided.
    if (
      data.basePrice !== undefined &&
      data.salePrice !== undefined &&
      data.salePrice !== null &&
      data.salePrice > data.basePrice
    ) {
      ctx.addIssue({
        code: "custom",
        path: ["salePrice"],
        message: "Sale price cannot exceed base price",
      });
    }
  });

/*
|--------------------------------------------------------------------------
| Product Status Validation
|--------------------------------------------------------------------------
| PATCH /api/v1/admin/products/:productId/status
|--------------------------------------------------------------------------
*/

export const updateProductStatusSchema = z
  .object({
    status: z.enum(
      ["draft", "active", "archived"],
      {
        error: "Invalid product status",
      }
    ),
  })
  .strict();
