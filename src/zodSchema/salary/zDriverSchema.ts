import { Z_PaginationParams } from "@zodSchema/zodSchema";
import { z } from "zod";

export const optional = z.object({
  page_size: z.number().optional().nullable(),
  current: z.number().optional().nullable(),
});

export const Z_SalaryDriverList = z
  .object({
    search: z.string().optional(),
    date: z.string(),
    date_to: z.string().optional().nullable(),
    filters: z
      .object({
        driver_code: z.string().optional().nullable(),
        status: z.enum(["PENDING", "CONFIRMED", "PAID"]).optional().nullable(),
      })
      .optional()
      .nullable(),
  })
  .merge(Z_PaginationParams);
// .extend({
//   optional,
// });

// *
// === key search: [un comment this]
//
//
//
// To use seryu pagination structure for use `page_size` and `current` version.
// *
