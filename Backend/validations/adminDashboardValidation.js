import { z } from "zod";

export const dashboardPeriodSchema = z
  .object({
    period: z.enum(["7d", "30d", "90d"]).default("30d"),
  })
  .strict();

export const dashboardInventorySchema = z
  .object({
    limit: z.coerce.number().int().min(1).max(100).default(20),
  })
  .strict();
