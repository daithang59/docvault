import { createHash, timingSafeEqual } from 'crypto';
import { INTERNAL_CALL_HEADER } from './throttler.constants';

/**
 * Check if a request is a trusted internal service-to-service call.
 * Internal calls are exempt from rate limiting.
 *
 * Security: the header must carry the shared secret in INTERNAL_CALL_SECRET,
 * compared in constant time. Fail-closed — if no secret is configured, NO
 * request is treated as internal (a guessable `true` flag is never enough).
 */
export function isInternalServiceCall(req: any): boolean {
  const secret = process.env.INTERNAL_CALL_SECRET;
  if (!secret || secret.trim().length === 0) {
    return false;
  }

  const header = req.headers?.[INTERNAL_CALL_HEADER];
  if (typeof header !== 'string' || header.length === 0) {
    return false;
  }

  // Constant-time comparison via fixed-length digests to avoid leaking length.
  const providedDigest = createHash('sha256').update(header, 'utf8').digest();
  const expectedDigest = createHash('sha256').update(secret, 'utf8').digest();
  return timingSafeEqual(providedDigest, expectedDigest);
}

