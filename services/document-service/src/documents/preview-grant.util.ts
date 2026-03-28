import { createHmac, timingSafeEqual } from 'crypto';

export type PreviewGrantPayload = {
  actorId: string;
  docId: string;
  version: number;
  objectKey: string;
  filename: string;
  contentType?: string;
  expiresAt: string;
  classification: string;
};

function getSecret() {
  return (
    process.env.PREVIEW_GRANT_SECRET ??
    process.env.DOWNLOAD_GRANT_SECRET ??
    'docvault-download-grant-secret'
  );
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

  const expectedSignature = createHmac('sha256', getSecret())
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

  const payload = JSON.parse(
    Buffer.from(encodedPayload, 'base64url').toString('utf8'),
  ) as PreviewGrantPayload;

  if (new Date(payload.expiresAt).getTime() <= Date.now()) {
    throw new Error('Preview grant token expired');
  }

  if (payload.actorId !== requestingActorId) {
    throw new Error('Preview grant token actorId mismatch');
  }

  return payload;
}
