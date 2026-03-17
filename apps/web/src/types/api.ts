/**
 * Compatibility shim for types/api.ts.
 * Re-exports canonical ApiError from lib/api/errors.
 * @deprecated Import from @/lib/api/errors directly.
 */
export type { ApiErrorData as ApiErrorResponse } from '@/lib/api/errors';
export { ApiError } from '@/lib/api/errors';
