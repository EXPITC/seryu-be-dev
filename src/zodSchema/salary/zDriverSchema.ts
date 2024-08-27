import { Z_PaginationParams } from "@zodSchema/zodSchema";
import { z } from "zod";

export const Z_SalaryDriverList = z
  .object({
    search: z.string().optional(),
    date: z.string(),
    date_to: z.string().optional().nullable(),
    driver_code: z.string().optional().nullable(),
    filters: z
      .object({
        status: z.enum(["PENDING", "CONFIRMED", "PAID"]).optional().nullable(),
      })
      .optional()
      .nullable(),
  })
  .merge(Z_PaginationParams);
