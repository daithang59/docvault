import { createHmac, timingSafeEqual } from 'crypto';

export type PreviewGrantPayload = {
  kid?: string;
  actorId: string;
  docId: string;
  version: number;
  objectKey: string;
  filename: string;
  contentType?: string;
  expiresAt: string;
  classification: string;
};

function requireEnv(name: string) {
  const value = process.env[name];
  if (!value || value.trim().length === 0) {
    throw new Error(`${name} is required`);
  }
  return value;
}

function getLegacySecret() {
  const value = process.env.PREVIEW_GRANT_SECRET;
  if (!value || value.trim().length === 0) {
    throw new Error('PREVIEW_GRANT_SECRET is required');
  }
  return value;
}

function getSecretForKid(kid: string) {
  const acceptedKids = [
    process.env.GRANT_TOKEN_CURRENT_KID,
    process.env.GRANT_TOKEN_PREVIOUS_KID,
  ].filter((value): value is string => Boolean(value?.trim()));

  if (!acceptedKids.includes(kid)) {
    throw new Error('Preview grant token kid is not accepted');
  }

  return requireEnv(`PREVIEW_GRANT_SECRET_${kid}`);
}

/**
 * Verify a preview grant token issued by metadata-service.
 *
 * @param token             The HMAC-signed preview grant token
 * @param requestingActorId The actorId extracted from the current user's JWT
 *
 * @throws Error If token is malformed, signature invalid, expired,
 *               or the token was not issued for this actorId.
 */
export function verifyPreviewGrantToken(
  token: string,
  requestingActorId: string,
): PreviewGrantPayload {
  const [encodedPayload, signature] = token.split('.');
  if (!encodedPayload || !signature) {
    throw new Error('Invalid preview grant token format');
  }

  const payload = JSON.parse(
    Buffer.from(encodedPayload, 'base64url').toString('utf8'),
  ) as PreviewGrantPayload;

  const secret = payload.kid ? getSecretForKid(payload.kid) : getLegacySecret();

  const expectedSignature = createHmac('sha256', secret)
    .update(encodedPayload)
    .digest('base64url');
  const expectedBuffer = Buffer.from(expectedSignature);
  const actualBuffer = Buffer.from(signature);

  if (
    expectedBuffer.length !== actualBuffer.length ||
    !timingSafeEqual(expectedBuffer, actualBuffer)
  ) {
    throw new Error('Preview grant token signature mismatch');
  }

  if (new Date(payload.expiresAt).getTime() <= Date.now()) {
    throw new Error('Preview grant token expired');
  }

  if (payload.actorId !== requestingActorId) {
    throw new Error('Preview grant token actorId mismatch');
  }

  return payload;
}
