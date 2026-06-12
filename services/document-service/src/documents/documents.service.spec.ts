import { Readable } from 'stream';
import { createHmac } from 'crypto';
import { BadRequestException, ForbiddenException } from '@nestjs/common';
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
      { scan: jest.fn() } as any,
      { scan: jest.fn() } as any,
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

describe('DocumentsService upload security controls', () => {
  const context = {
    traceId: 'trace-1',
    actorId: 'editor-1',
    roles: ['editor'],
    authorization: 'Bearer token',
    ip: '127.0.0.1',
  };
  const user = { sub: 'editor-1', roles: ['editor'] };
  const file = {
    originalname: 'evidence.txt',
    mimetype: 'text/plain',
    size: 25,
    buffer: Buffer.from('ordinary document content'),
  } as Express.Multer.File;

  let metadataClient: {
    getDocument: jest.Mock;
    createVersion: jest.Mock;
  };
  let storage: {
    buildObjectKey: jest.Mock;
    upload: jest.Mock;
    deleteObject: jest.Mock;
  };
  let audit: { emitEvent: jest.Mock };
  let malwareScanner: { scan: jest.Mock };
  let dlpScanner: { scan: jest.Mock };
  let service: DocumentsService;

  beforeEach(() => {
    metadataClient = {
      getDocument: jest.fn().mockResolvedValue({
        ownerId: 'editor-1',
        currentVersion: 0,
      }),
      createVersion: jest.fn().mockResolvedValue({ version: 1 }),
    };
    storage = {
      buildObjectKey: jest.fn().mockReturnValue('doc/doc-1/v1/evidence.txt'),
      upload: jest.fn().mockResolvedValue(undefined),
      deleteObject: jest.fn().mockResolvedValue(undefined),
    };
    audit = { emitEvent: jest.fn().mockResolvedValue(undefined) };
    malwareScanner = {
      scan: jest.fn().mockResolvedValue({ clean: true, engine: 'local-eicar' }),
    };
    dlpScanner = {
      scan: jest.fn().mockResolvedValue({ status: 'CLEAR', findings: [] }),
    };
    service = new (DocumentsService as any)(
      metadataClient,
      storage,
      audit,
      { applyWatermark: jest.fn() },
      malwareScanner,
      dlpScanner,
    );
  });

  it('blocks malware before storage and metadata version creation', async () => {
    malwareScanner.scan.mockResolvedValue({
      clean: false,
      engine: 'local-eicar',
      threatName: 'EICAR-Test-File',
    });

    await expect(
      service.upload('doc-1', file, user as any, context as any),
    ).rejects.toThrow(BadRequestException);

    expect(storage.upload).not.toHaveBeenCalled();
    expect(metadataClient.createVersion).not.toHaveBeenCalled();
    expect(audit.emitEvent).toHaveBeenCalledWith(
      context,
      expect.objectContaining({
        action: 'MALWARE_UPLOAD_BLOCKED',
        result: 'DENY',
        reason: 'EICAR-Test-File',
      }),
    );
  });

  it('passes DLP findings to metadata and records audit evidence', async () => {
    const findings = [
      {
        type: 'EMAIL',
        pattern: 'email address',
        severity: 'MEDIUM',
        count: 1,
      },
    ];
    dlpScanner.scan.mockResolvedValue({
      status: 'DETECTED',
      findings,
      suggestedClassification: 'CONFIDENTIAL',
    });

    await service.upload('doc-1', file, user as any, context as any);

    expect(metadataClient.createVersion).toHaveBeenCalledWith(
      'doc-1',
      expect.objectContaining({
        dlpStatus: 'DETECTED',
        dlpFindings: findings,
        dlpSuggestedClassification: 'CONFIDENTIAL',
      }),
      context,
    );
    expect(audit.emitEvent).toHaveBeenCalledWith(
      context,
      expect.objectContaining({
        action: 'DLP_PATTERN_DETECTED',
        result: 'SUCCESS',
        metadata: expect.objectContaining({
          findingCount: 1,
          suggestedClassification: 'CONFIDENTIAL',
        }),
      }),
    );
  });
});

describe('DocumentsService preview watermark', () => {
  const PREVIEW_SECRET = 'test-preview-secret';

  function previewToken(payload: Record<string, unknown>) {
    const full = {
      actorId: 'viewer-1',
      docId: 'doc-1',
      version: 1,
      objectKey: 'doc/doc-1/v1/file.pdf',
      filename: 'file.pdf',
      contentType: 'application/pdf',
      expiresAt: new Date(Date.now() + 60_000).toISOString(),
      classification: 'PUBLIC',
      ...payload,
    };
    const encoded = Buffer.from(JSON.stringify(full)).toString('base64url');
    const signature = createHmac('sha256', PREVIEW_SECRET)
      .update(encoded)
      .digest('base64url');
    return `${encoded}.${signature}`;
  }

  const baseContext = {
    traceId: 't',
    actorId: 'viewer-1',
    roles: ['viewer'],
    authorization: 'Bearer x',
    ip: '127.0.0.1',
  };

  function makeService(opts: {
    classification: string;
    applyWatermark: jest.Mock;
    getObjectStream: jest.Mock;
  }) {
    const metadataClient = {
      authorizePreview: jest.fn().mockResolvedValue({
        grantToken: previewToken({ classification: opts.classification }),
        classification: opts.classification,
      }),
    };
    return new DocumentsService(
      metadataClient as any,
      { getObjectStream: opts.getObjectStream } as any,
      { emitEvent: jest.fn() } as any,
      { applyWatermark: opts.applyWatermark } as any,
      { scan: jest.fn() } as any,
      { scan: jest.fn() } as any,
    );
  }

  beforeEach(() => {
    process.env.PREVIEW_GRANT_SECRET = PREVIEW_SECRET;
  });
  afterEach(() => {
    delete process.env.PREVIEW_GRANT_SECRET;
  });

  it('watermarks the preview buffer for a SECRET document', async () => {
    const watermarked = Buffer.from('WATERMARKED');
    const applyWatermark = jest.fn().mockResolvedValue(watermarked);
    const getObjectStream = jest.fn().mockResolvedValue({
      Body: Readable.from([Buffer.from('original-bytes')]),
      ContentLength: 14,
    });
    const service = makeService({
      classification: 'SECRET',
      applyWatermark,
      getObjectStream,
    });

    const result = await service.preview({
      docId: 'doc-1',
      context: baseContext as any,
    });

    expect(applyWatermark).toHaveBeenCalledTimes(1);
    expect(result.watermarked).toBe(true);
    expect(result.buffer?.equals(watermarked)).toBe(true);
  });

  it('does not watermark the preview for a PUBLIC document', async () => {
    const applyWatermark = jest.fn();
    const getObjectStream = jest.fn().mockResolvedValue({
      Body: Readable.from([Buffer.from('plain')]),
      ContentLength: 5,
    });
    const service = makeService({
      classification: 'PUBLIC',
      applyWatermark,
      getObjectStream,
    });

    const result = await service.preview({
      docId: 'doc-1',
      context: baseContext as any,
    });

    expect(applyWatermark).not.toHaveBeenCalled();
    expect(result.watermarked).toBeFalsy();
    expect(result.object).toBeDefined();
  });
});
