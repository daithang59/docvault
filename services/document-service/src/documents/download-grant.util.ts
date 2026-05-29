import { createHmac, timingSafeEqual } from 'crypto';

export type GrantPayload = {
  kid?: string;
  actorId: string;
  docId: string;
  version: number;
  objectKey: string;
  filename: string;
  contentType?: string;
  expiresAt: string;
  classification: string;
  watermarkRequired: boolean;
};

function requireEnv(name: string) {
  const value = process.env[name];
  if (!value || value.trim().length === 0) {
    throw new Error(`${name} is required`);
  }
  return value;
}

function getLegacySecret() {
  const value = process.env.DOWNLOAD_GRANT_SECRET;
  if (!value || value.trim().length === 0) {
    throw new Error('DOWNLOAD_GRANT_SECRET is required');
  }
  return value;
}

function getSecretForKid(kid: string) {
  const acceptedKids = [
    process.env.GRANT_TOKEN_CURRENT_KID,
    process.env.GRANT_TOKEN_PREVIOUS_KID,
  ].filter((value): value is string => Boolean(value?.trim()));

  if (!acceptedKids.includes(kid)) {
    throw new Error('Grant token kid is not accepted');
  }

  return requireEnv(`DOWNLOAD_GRANT_SECRET_${kid}`);
}

/**
 * Verify a download grant token and bind it to the requesting actorId.
 *
 * @param token          The HMAC-signed grant token from metadata-service
 * @param requestingActorId  The actorId extracted from the current user's JWT
 *
 * @throws Error  If token is malformed, signature invalid, expired,
 *                 or the token was not issued for this actorId.
 */
export function verifyGrantToken(
  token: string,
  requestingActorId: string,
): GrantPayload {
  const [encodedPayload, signature] = token.split('.');
  if (!encodedPayload || !signature) {
    throw new Error('Invalid grant token format');
  }

  const payload = JSON.parse(
    Buffer.from(encodedPayload, 'base64url').toString('utf8'),
  ) as GrantPayload;

  const secret = payload.kid
    ? getSecretForKid(payload.kid)
    : getLegacySecret();

  const expectedSignature = createHmac('sha256', secret)
    .update(encodedPayload)
    .digest('base64url');
  const expectedBuffer = Buffer.from(expectedSignature);
  const actualBuffer = Buffer.from(signature);

  if (
    expectedBuffer.length !== actualBuffer.length ||
    !timingSafeEqual(expectedBuffer, actualBuffer)
  ) {
    throw new Error('Grant token signature mismatch');
  }

  if (new Date(payload.expiresAt).getTime() <= Date.now()) {
    throw new Error('Grant token expired');
  }

  // Token must have been issued for the same actor requesting download
  if (payload.actorId !== requestingActorId) {
    throw new Error('Grant token actorId mismatch');
  }

  return payload;
}
