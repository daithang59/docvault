import { createHmac } from 'crypto';
import { verifyGrantToken, GrantPayload } from './download-grant.util';

function sign(payload: GrantPayload, secret: string) {
  const encoded = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const signature = createHmac('sha256', secret)
    .update(encoded)
    .digest('base64url');
  return `${encoded}.${signature}`;
}

describe('verifyGrantToken', () => {
  const payload: GrantPayload = {
    actorId: 'viewer-1',
    docId: 'doc-1',
    version: 1,
    objectKey: 'doc/doc-1/v1/file.pdf',
    filename: 'file.pdf',
    contentType: 'application/pdf',
    expiresAt: new Date(Date.now() + 60_000).toISOString(),
    classification: 'PUBLIC',
    watermarkRequired: false,
  };

  afterEach(() => {
    delete process.env.DOWNLOAD_GRANT_SECRET;
  });

  it('requires DOWNLOAD_GRANT_SECRET', () => {
    const token = sign(payload, 'unused');

    expect(() => verifyGrantToken(token, payload.actorId)).toThrow(
      'DOWNLOAD_GRANT_SECRET is required',
    );
  });

  it('verifies a token signed with the configured download secret', () => {
    process.env.DOWNLOAD_GRANT_SECRET = 'test-download-secret';
    const token = sign(payload, process.env.DOWNLOAD_GRANT_SECRET);

    expect(verifyGrantToken(token, payload.actorId)).toEqual(payload);
  });
});
