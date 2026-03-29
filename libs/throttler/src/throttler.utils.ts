import { INTERNAL_CALL_HEADER } from './throttler.constants';

/**
 * Check if a request is an internal service-to-service call.
 * Internal calls are exempt from rate limiting.
 */
export function isInternalServiceCall(req: any): boolean {
  const header = req.headers?.[INTERNAL_CALL_HEADER];
  return header === 'true';
}
