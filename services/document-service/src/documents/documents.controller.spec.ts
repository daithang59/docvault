import { BadRequestException } from '@nestjs/common';
import { DocumentsController } from './documents.controller';

describe('DocumentsController', () => {
  const streamResponse = {
    filename: 'file.pdf',
    contentType: 'application/pdf',
    stream: 'stream-body',
  };
  let documentsService: {
    getStream: jest.Mock;
    getStreamWithToken: jest.Mock;
  };
  let controller: DocumentsController;
  let res: { setHeader: jest.Mock };
  const req = {
    headers: {},
    traceId: 'trace-1',
    user: { sub: 'viewer-1', roles: ['viewer'] },
  };

  beforeEach(() => {
    documentsService = {
      getStream: jest.fn().mockResolvedValue(streamResponse),
      getStreamWithToken: jest.fn().mockResolvedValue(streamResponse),
    };
    controller = new DocumentsController(documentsService as any);
    res = { setHeader: jest.fn() };
  });

  it('re-authorizes through metadata when stream token is omitted', async () => {
    const result = await controller.streamVersion(
      'doc-1',
      '1',
      undefined as any,
      req,
      res as any,
    );

    expect(result).toBe(streamResponse.stream);
    expect(documentsService.getStream).toHaveBeenCalledWith(
      'doc-1',
      1,
      expect.objectContaining({ actorId: 'viewer-1' }),
    );
    expect(documentsService.getStreamWithToken).not.toHaveBeenCalled();
  });

  it('uses token-bound streaming when a grant token is provided', async () => {
    await controller.streamVersion(
      'doc-1',
      '1',
      'grant-token',
      req,
      res as any,
    );

    expect(documentsService.getStreamWithToken).toHaveBeenCalledWith(
      'doc-1',
      1,
      'grant-token',
      'viewer-1',
    );
    expect(documentsService.getStream).not.toHaveBeenCalled();
  });

  it('rejects invalid stream versions before calling the service', async () => {
    await expect(
      controller.streamVersion('doc-1', '0', undefined as any, req, res as any),
    ).rejects.toThrow(BadRequestException);

    expect(documentsService.getStream).not.toHaveBeenCalled();
    expect(documentsService.getStreamWithToken).not.toHaveBeenCalled();
  });
});
