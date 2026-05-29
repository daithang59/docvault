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
  const payload: PreviewGrantPayload = {
    actorId: 'viewer-1',
    docId: 'doc-1',
    version: 1,
    objectKey: 'doc/doc-1/v1/file.pdf',
    filename: 'file.pdf',
    contentType: 'application/pdf',
    expiresAt: new Date(Date.now() + 60_000).toISOString(),
    classification: 'PUBLIC',
  };

  afterEach(() => {
    delete process.env.PREVIEW_GRANT_SECRET;
  });

  it('requires PREVIEW_GRANT_SECRET', () => {
    const token = sign(payload, 'unused');

    expect(() => verifyPreviewGrantToken(token, payload.actorId)).toThrow(
      'PREVIEW_GRANT_SECRET is required',
    );
  });

  it('verifies a token signed with the configured preview secret', () => {
    process.env.PREVIEW_GRANT_SECRET = 'test-preview-secret';
    const token = sign(payload, process.env.PREVIEW_GRANT_SECRET);

    expect(verifyPreviewGrantToken(token, payload.actorId)).toEqual(payload);
  });
});
