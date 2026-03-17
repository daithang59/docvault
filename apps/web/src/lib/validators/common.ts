import { z } from 'zod';

/** Zod schema for a non-empty UUID-like string ID */
export const zId = z.string().min(1, 'ID is required');

/** Zod schema for a date range pair */
export const zDateRange = z.object({
  from: z.string().optional(),
  to: z.string().optional(),
});

/** Zod schema for pagination params */
export const zPagination = z.object({
  page: z.number().int().min(1).optional(),
  pageSize: z.number().int().min(1).max(100).optional(),
});

/** Non-empty trimmed string */
export const zNonEmptyString = z.string().trim().min(1, 'This field is required');

/** Optional trimmed string (empty string → undefined) */
export const zOptionalString = z
  .string()
  .trim()
  .transform((v) => (v === '' ? undefined : v))
  .optional();
