import { z } from "zod";

const dateTimeSchema = z.iso.datetime({ offset: true });

export const auditLogQuerySchema = z
  .object({
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(25),
    actorType: z.enum(["admin", "customer", "system"]).optional(),
    action: z.string().trim().regex(/^[a-z][a-z0-9_.-]{0,99}$/i).optional(),
    resource: z.string().trim().regex(/^[a-z][a-z0-9_.-]{0,99}$/i).optional(),
    status: z.enum(["success", "failure"]).optional(),
    from: dateTimeSchema.optional(),
    to: dateTimeSchema.optional(),
  })
  .strict()
  .superRefine((query, context) => {
    if (
      query.from &&
      query.to &&
      new Date(query.from).getTime() > new Date(query.to).getTime()
    ) {
      context.addIssue({
        code: "custom",
        path: ["from"],
        message: "Start date must be before or equal to end date.",
      });
    }
    if (
      query.from &&
      query.to &&
      new Date(query.to).getTime() - new Date(query.from).getTime() >
        90 * 24 * 60 * 60 * 1000
    ) {
      context.addIssue({
        code: "custom",
        path: ["to"],
        message: "Audit log date range cannot exceed 90 days.",
      });
    }
  });
