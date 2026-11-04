import { z } from "zod";

const objectIdSchema = z
  .string()
  .trim()
  .regex(/^[a-f\d]{24}$/i, "Please provide a valid MongoDB ID");

const reviewFields = {
  rating: z
    .number()
    .int("Rating must be a whole number")
    .min(1, "Rating must be between 1 and 5")
    .max(5, "Rating must be between 1 and 5"),
  title: z
    .string()
    .trim()
    .max(150, "Title cannot exceed 150 characters")
    .optional(),
  comment: z
    .string()
    .trim()
    .max(2000, "Comment cannot exceed 2000 characters")
    .optional(),
};

export const createReviewSchema = z
  .object({
    orderId: objectIdSchema,
    ...reviewFields,
  })
  .strict();

export const updateReviewSchema = z
  .object(reviewFields)
  .partial()
  .strict()
  .refine(
    (data) => Object.keys(data).length > 0,
    "Provide at least one review field to update"
  );

export const moderateReviewSchema = z
  .object({
    decision: z.enum(["approve", "reject"]),
    rejectionReason: z
      .string()
      .trim()
      .min(1, "A rejection reason is required")
      .max(1000, "Rejection reason cannot exceed 1000 characters")
      .optional(),
  })
  .strict()
  .superRefine((data, ctx) => {
    if (
      data.decision === "reject" &&
      !data.rejectionReason
    ) {
      ctx.addIssue({
        code: "custom",
        path: ["rejectionReason"],
        message: "A rejection reason is required",
      });
    }

    if (
      data.decision === "approve" &&
      data.rejectionReason !== undefined
    ) {
      ctx.addIssue({
        code: "custom",
        path: ["rejectionReason"],
        message: "A rejection reason is only allowed when rejecting",
      });
    }
  });
