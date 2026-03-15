import { createHmac, timingSafeEqual } from 'crypto';

type GrantPayload = {
  actorId: string;
  docId: string;
  version: number;
  objectKey: string;
  filename: string;
  contentType?: string;
  expiresAt: string;
};

function getSecret() {
  return process.env.DOWNLOAD_GRANT_SECRET ?? 'docvault-download-grant-secret';
}

export function verifyGrantToken(token: string): GrantPayload {
  const [encodedPayload, signature] = token.split('.');
  if (!encodedPayload || !signature) {
    throw new Error('Invalid grant token format');
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
    throw new Error('Grant token signature mismatch');
  }

  const payload = JSON.parse(
    Buffer.from(encodedPayload, 'base64url').toString('utf8'),
  ) as GrantPayload;

  if (new Date(payload.expiresAt).getTime() <= Date.now()) {
    throw new Error('Grant token expired');
  }

  return payload;
}
