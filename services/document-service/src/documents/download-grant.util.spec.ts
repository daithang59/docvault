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
  type RotatingGrantPayload = GrantPayload & { kid?: string };

  function makePayload(
    overrides: Partial<RotatingGrantPayload> = {},
  ): RotatingGrantPayload {
    return {
      actorId: 'viewer-1',
      docId: 'doc-1',
      version: 1,
      objectKey: 'doc/doc-1/v1/file.pdf',
      filename: 'file.pdf',
      contentType: 'application/pdf',
      expiresAt: new Date(Date.now() + 60_000).toISOString(),
      classification: 'PUBLIC',
      watermarkRequired: false,
      ...overrides,
    };
  }

  afterEach(() => {
    delete process.env.DOWNLOAD_GRANT_SECRET;
    delete process.env.GRANT_TOKEN_CURRENT_KID;
    delete process.env.GRANT_TOKEN_PREVIOUS_KID;
    delete process.env.DOWNLOAD_GRANT_SECRET_2026_05;
    delete process.env.DOWNLOAD_GRANT_SECRET_2026_04;
    delete process.env.DOWNLOAD_GRANT_SECRET_2026_03;
  });

  it('requires DOWNLOAD_GRANT_SECRET', () => {
    const payload = makePayload();
    const token = sign(payload, 'unused');

    expect(() => verifyGrantToken(token, payload.actorId)).toThrow(
      'DOWNLOAD_GRANT_SECRET is required',
    );
  });

  it('verifies a token signed with the configured download secret', () => {
    const payload = makePayload();
    process.env.DOWNLOAD_GRANT_SECRET = 'test-download-secret';
    const token = sign(payload, process.env.DOWNLOAD_GRANT_SECRET);

    expect(verifyGrantToken(token, payload.actorId)).toEqual(payload);
  });

  it('verifies a current kid token with the current download secret', () => {
    process.env.GRANT_TOKEN_CURRENT_KID = '2026_05';
    process.env.GRANT_TOKEN_PREVIOUS_KID = '2026_04';
    process.env.DOWNLOAD_GRANT_SECRET_2026_05 = 'current-secret';
    process.env.DOWNLOAD_GRANT_SECRET_2026_04 = 'previous-secret';
    const payload = makePayload({ kid: '2026_05' });
    const token = sign(payload, 'current-secret');

    expect(verifyGrantToken(token, payload.actorId)).toEqual(payload);
  });

  it('verifies a previous kid token with the previous download secret', () => {
    process.env.GRANT_TOKEN_CURRENT_KID = '2026_05';
    process.env.GRANT_TOKEN_PREVIOUS_KID = '2026_04';
    process.env.DOWNLOAD_GRANT_SECRET_2026_05 = 'current-secret';
    process.env.DOWNLOAD_GRANT_SECRET_2026_04 = 'previous-secret';
    const payload = makePayload({ kid: '2026_04' });
    const token = sign(payload, 'previous-secret');

    expect(verifyGrantToken(token, payload.actorId)).toEqual(payload);
  });

  it('rejects a kid outside the configured current/previous window', () => {
    process.env.GRANT_TOKEN_CURRENT_KID = '2026_05';
    process.env.GRANT_TOKEN_PREVIOUS_KID = '2026_04';
    process.env.DOWNLOAD_GRANT_SECRET_2026_03 = 'old-secret';
    const payload = makePayload({ kid: '2026_03' });
    const token = sign(payload, 'old-secret');

    expect(() => verifyGrantToken(token, payload.actorId)).toThrow(
      'Grant token kid is not accepted',
    );
  });

  it('rejects expired download grants', () => {
    process.env.DOWNLOAD_GRANT_SECRET = 'test-download-secret';
    const payload = makePayload({
      expiresAt: new Date(Date.now() - 1_000).toISOString(),
    });
    const token = sign(payload, process.env.DOWNLOAD_GRANT_SECRET);

    expect(() => verifyGrantToken(token, payload.actorId)).toThrow(
      'Grant token expired',
    );
  });

  it('rejects grants issued to another actor', () => {
    process.env.DOWNLOAD_GRANT_SECRET = 'test-download-secret';
    const payload = makePayload();
    const token = sign(payload, process.env.DOWNLOAD_GRANT_SECRET);

    expect(() => verifyGrantToken(token, 'other-viewer')).toThrow(
      'Grant token actorId mismatch',
    );
  });
});
