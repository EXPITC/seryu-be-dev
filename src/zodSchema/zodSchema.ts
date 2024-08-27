import { z } from "zod";

export const Z_PaginationParams = z.object({
  pagination: z.object({
    take: z.number(),
    skip: z.number(),
  }),
});

export const Z_IdParams = z.object({
  id: z.string(),
});
