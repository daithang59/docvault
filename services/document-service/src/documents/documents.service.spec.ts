import { createHmac } from 'crypto';
import { ForbiddenException } from '@nestjs/common';
import { DocumentsService } from './documents.service';
import { GrantPayload } from './download-grant.util';

function sign(payload: GrantPayload, secret: string) {
  const encoded = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const signature = createHmac('sha256', secret)
    .update(encoded)
    .digest('base64url');
  return `${encoded}.${signature}`;
}

describe('DocumentsService stream grants', () => {
  const payload: GrantPayload = {
    actorId: 'viewer-1',
    docId: 'doc-1',
    version: 2,
    objectKey: 'doc/doc-1/v2/file.pdf',
    filename: 'file.pdf',
    contentType: 'application/pdf',
    expiresAt: new Date(Date.now() + 60_000).toISOString(),
    classification: 'PUBLIC',
    watermarkRequired: false,
  };
  let service: DocumentsService;
  let storageService: { getObjectStream: jest.Mock };

  beforeEach(() => {
    process.env.DOWNLOAD_GRANT_SECRET = 'test-download-secret';
    storageService = { getObjectStream: jest.fn() };
    service = new DocumentsService(
      {} as any,
      storageService as any,
      { emitEvent: jest.fn() } as any,
      { applyWatermark: jest.fn() } as any,
    );
  });

  afterEach(() => {
    delete process.env.DOWNLOAD_GRANT_SECRET;
  });

  it('rejects a download grant bound to a different document', async () => {
    const token = sign(payload, process.env.DOWNLOAD_GRANT_SECRET as string);

    await expect(
      service.getStreamWithToken('other-doc', 2, token, 'viewer-1'),
    ).rejects.toThrow(ForbiddenException);
    expect(storageService.getObjectStream).not.toHaveBeenCalled();
  });

  it('rejects a download grant bound to a different version', async () => {
    const token = sign(payload, process.env.DOWNLOAD_GRANT_SECRET as string);

    await expect(
      service.getStreamWithToken('doc-1', 3, token, 'viewer-1'),
    ).rejects.toThrow(ForbiddenException);
    expect(storageService.getObjectStream).not.toHaveBeenCalled();
  });
});
