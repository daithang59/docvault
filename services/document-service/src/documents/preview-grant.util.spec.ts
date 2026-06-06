import { createHmac } from 'crypto';
import {
  PreviewGrantPayload,
  verifyPreviewGrantToken,
} from './preview-grant.util';

function sign(payload: PreviewGrantPayload, secret: string) {
  const encoded = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const signature = createHmac('sha256', secret)
    .update(encoded)
    .digest('base64url');
  return `${encoded}.${signature}`;
}

describe('verifyPreviewGrantToken', () => {
  type RotatingPreviewGrantPayload = PreviewGrantPayload & { kid?: string };

  function makePayload(
    overrides: Partial<RotatingPreviewGrantPayload> = {},
  ): RotatingPreviewGrantPayload {
    return {
      actorId: 'viewer-1',
      docId: 'doc-1',
      version: 1,
      objectKey: 'doc/doc-1/v1/file.pdf',
      filename: 'file.pdf',
      contentType: 'application/pdf',
      expiresAt: new Date(Date.now() + 60_000).toISOString(),
      classification: 'PUBLIC',
      ...overrides,
    };
  }

  afterEach(() => {
    delete process.env.PREVIEW_GRANT_SECRET;
    delete process.env.GRANT_TOKEN_CURRENT_KID;
    delete process.env.GRANT_TOKEN_PREVIOUS_KID;
    delete process.env.PREVIEW_GRANT_SECRET_2026_05;
    delete process.env.PREVIEW_GRANT_SECRET_2026_04;
    delete process.env.PREVIEW_GRANT_SECRET_2026_03;
  });

  it('requires PREVIEW_GRANT_SECRET', () => {
    const payload = makePayload();
    const token = sign(payload, 'unused');

    expect(() => verifyPreviewGrantToken(token, payload.actorId)).toThrow(
      'PREVIEW_GRANT_SECRET is required',
    );
  });

  it('verifies a token signed with the configured preview secret', () => {
    const payload = makePayload();
    process.env.PREVIEW_GRANT_SECRET = 'test-preview-secret';
    const token = sign(payload, process.env.PREVIEW_GRANT_SECRET);

    expect(verifyPreviewGrantToken(token, payload.actorId)).toEqual(payload);
  });

  it('verifies a current kid token with the current preview secret', () => {
    process.env.GRANT_TOKEN_CURRENT_KID = '2026_05';
    process.env.GRANT_TOKEN_PREVIOUS_KID = '2026_04';
    process.env.PREVIEW_GRANT_SECRET_2026_05 = 'current-secret';
    process.env.PREVIEW_GRANT_SECRET_2026_04 = 'previous-secret';
    const payload = makePayload({ kid: '2026_05' });
    const token = sign(payload, 'current-secret');

    expect(verifyPreviewGrantToken(token, payload.actorId)).toEqual(payload);
  });

  it('verifies a previous kid token with the previous preview secret', () => {
    process.env.GRANT_TOKEN_CURRENT_KID = '2026_05';
    process.env.GRANT_TOKEN_PREVIOUS_KID = '2026_04';
    process.env.PREVIEW_GRANT_SECRET_2026_05 = 'current-secret';
    process.env.PREVIEW_GRANT_SECRET_2026_04 = 'previous-secret';
    const payload = makePayload({ kid: '2026_04' });
    const token = sign(payload, 'previous-secret');

    expect(verifyPreviewGrantToken(token, payload.actorId)).toEqual(payload);
  });

  it('rejects a kid outside the configured current/previous window', () => {
    process.env.GRANT_TOKEN_CURRENT_KID = '2026_05';
    process.env.GRANT_TOKEN_PREVIOUS_KID = '2026_04';
    process.env.PREVIEW_GRANT_SECRET_2026_03 = 'old-secret';
    const payload = makePayload({ kid: '2026_03' });
    const token = sign(payload, 'old-secret');

    expect(() => verifyPreviewGrantToken(token, payload.actorId)).toThrow(
      'Preview grant token kid is not accepted',
    );
  });

  it('rejects expired preview grants', () => {
    process.env.PREVIEW_GRANT_SECRET = 'test-preview-secret';
    const payload = makePayload({
      expiresAt: new Date(Date.now() - 1_000).toISOString(),
    });
    const token = sign(payload, process.env.PREVIEW_GRANT_SECRET);

    expect(() => verifyPreviewGrantToken(token, payload.actorId)).toThrow(
      'Preview grant token expired',
    );
  });

  it('rejects grants issued to another actor', () => {
    process.env.PREVIEW_GRANT_SECRET = 'test-preview-secret';
    const payload = makePayload();
    const token = sign(payload, process.env.PREVIEW_GRANT_SECRET);

    expect(() => verifyPreviewGrantToken(token, 'other-viewer')).toThrow(
      'Preview grant token actorId mismatch',
    );
  });
});
