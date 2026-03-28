import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  StreamableFile,
} from '@nestjs/common';
import { AxiosError } from 'axios';
import { AuditClient } from '../audit/audit.client';
import {
  RequestContext,
  ServiceUser,
  buildActorId,
} from '../common/request-context';
import { MetadataClient } from '../metadata/metadata.client';
import { StorageService } from '../storage/storage.service';
import { sha256Hex } from '../storage/checksum.helper';
import { PresignDownloadDto } from './dto/presign-download.dto';
import { verifyGrantToken } from './download-grant.util';
import { verifyPreviewGrantToken } from './preview-grant.util';
import { WatermarkService } from '../watermark/watermark.service';

@Injectable()
export class DocumentsService {
  constructor(
    private readonly metadataClient: MetadataClient,
    private readonly storageService: StorageService,
    private readonly auditClient: AuditClient,
    private readonly watermarkService: WatermarkService,
  ) {}

  async upload(
    docId: string,
    file: Express.Multer.File | undefined,
    user: ServiceUser,
    context: RequestContext,
  ) {
    if (!file) {
      throw new BadRequestException('File is required');
    }

    const document = await this.metadataClient.getDocument(docId, context);
    this.assertCanUpload(document.ownerId, user);

    const nextVersion = Number(document.currentVersion ?? 0) + 1;
    const checksum = sha256Hex(file.buffer);
    const objectKey = this.storageService.buildObjectKey(
      docId,
      nextVersion,
      file.originalname,
    );

    await this.storageService.upload({
      objectKey,
      body: file.buffer,
      contentType: file.mimetype,
      metadata: {
        checksum,
        uploadedBy: buildActorId(user),
      },
    });

    // Emit audit FIRST — immediately after MinIO upload succeeds.
    // If createVersion fails below, we still log the upload attempt.
    await this.auditClient.emitEvent(context, {
      action: 'DOCUMENT_UPLOADED',
      resourceType: 'DOCUMENT',
      resourceId: docId,
      result: 'SUCCESS',
      metadata: {
        fileName: file.originalname,
        mimeType: file.mimetype,
        size: file.size,
        version: nextVersion,
      },
    });

    try {
      const versionRecord = await this.metadataClient.createVersion(
        docId,
        {
          version: nextVersion,
          objectKey,
          checksum,
          size: file.size,
          filename: file.originalname,
          contentType: file.mimetype,
        },
        context,
      );

      return {
        ...versionRecord,
        checksum,
        objectKey,
      };
    } catch (error) {
      // Rollback: delete the orphaned file from MinIO
      await this.storageService.deleteObject(objectKey).catch((e) => {
        console.error(
          `[DocumentsService] Failed to cleanup orphaned object ${objectKey}: ${e.message}`,
        );
      });
      throw error;
    }
  }

  async presignDownload(
    docId: string,
    dto: PresignDownloadDto,
    context: RequestContext,
  ) {
    try {
      let grantPayload: ReturnType<typeof verifyGrantToken>;
      let expiresInSeconds: number;

      if (dto.grantToken) {
        // grantToken provided — frontend already authorized, skip metadata call
        grantPayload = verifyGrantToken(dto.grantToken, context.actorId);
        expiresInSeconds = 300; // consistent default, not from metadata
      } else {
        // Fallback: re-authorize via metadata service
        const authorization = await this.metadataClient.authorizeDownload(
          docId,
          { version: dto.version },
          context,
        );
        grantPayload = verifyGrantToken(authorization.grantToken, context.actorId);
        expiresInSeconds = authorization.expiresInSeconds;
      }

      // SECURITY: CONFIDENTIAL/SECRET documents must go through the streaming
      // path so the watermark can be applied. Reject presigned URL for these.
      if (grantPayload.watermarkRequired) {
        return {
          docId,
          version: grantPayload.version,
          filename: grantPayload.filename,
          expiresAt: new Date(Date.now() + expiresInSeconds * 1000).toISOString(),
          expiresInSeconds,
          url: null,
          watermarkRequired: true,
          streamingEndpoint: `/documents/${docId}/versions/${grantPayload.version}/stream`,
        };
      }

      const url = await this.storageService.createDownloadUrl({
        objectKey: grantPayload.objectKey,
        filename: grantPayload.filename,
        expiresInSeconds,
      });

      return {
        docId,
        version: grantPayload.version,
        filename: grantPayload.filename,
        expiresAt: new Date(Date.now() + expiresInSeconds * 1000).toISOString(),
        expiresInSeconds,
        url,
      };
    } catch (error) {
      await this.auditDownloadError(docId, context, error);
      throw error;
    }
  }

  /**
   * Stream a document by verifying a grant token directly — no metadata service call.
   * Used when the grant token was already obtained via authorizeDownload().
   */
  async getStreamWithToken(
    docId: string,
    grantToken: string,
    actorId: string,
  ): Promise<{
    filename: string;
    contentType?: string;
    stream: StreamableFile;
  }> {
    const grantPayload = verifyGrantToken(grantToken, actorId);

    const object = await this.storageService.getObjectStream(
      grantPayload.objectKey,
    );

    const rawBuffer = await this.readStreamToBuffer(object.Body as any);

    let finalBuffer = rawBuffer;
    if (grantPayload.watermarkRequired) {
      finalBuffer = this.watermarkService.applyWatermark(rawBuffer, {
        username: actorId,
        timestamp: new Date().toISOString(),
        classification: grantPayload.classification,
      });
    }

    return {
      filename: grantPayload.filename,
      contentType: grantPayload.contentType,
      stream: new StreamableFile(finalBuffer),
    };
  }

  async getStream(
    docId: string,
    version: number,
    context: RequestContext,
  ): Promise<{
    filename: string;
    contentType?: string;
    stream: StreamableFile;
  }> {
    try {
      const authorization = await this.metadataClient.authorizeDownload(
        docId,
        { version },
        context,
      );
      const grantPayload = verifyGrantToken(
        authorization.grantToken,
        context.actorId,
      );

      if (grantPayload.version !== version) {
        throw new ForbiddenException('Requested version is not authorized');
      }

      const object = await this.storageService.getObjectStream(
        grantPayload.objectKey,
      );

      const rawBuffer = await this.readStreamToBuffer(object.Body as any);

      let finalBuffer = rawBuffer;
      if (grantPayload.watermarkRequired) {
        finalBuffer = this.watermarkService.applyWatermark(rawBuffer, {
          username: context.actorId,
          timestamp: new Date().toISOString(),
          classification: grantPayload.classification,
        });
      }

      return {
        filename: grantPayload.filename,
        contentType: grantPayload.contentType,
        stream: new StreamableFile(finalBuffer),
      };
    } catch (error) {
      await this.auditDownloadError(docId, context, error);
      throw error;
    }
  }

  /**
   * Stream a document for inline preview (no watermark, passthrough from MinIO).
   * Returns the raw MinIO response object so the controller can pipe it directly.
   */
  async preview(params: {
    docId: string;
    version?: number;
    range?: { start: number; end: number };
    context: RequestContext;
  }): Promise<{
    filename: string;
    contentType?: string;
    fileSize?: number;
    object: ReturnType<StorageService['getObjectStream']> extends Promise<
      infer T
    >
      ? T
      : never;
  }> {
    const { docId, version, range, context } = params;

    const authorization = await this.metadataClient.authorizePreview(
      docId,
      { version },
      context,
    );

    const grantPayload = verifyPreviewGrantToken(
      authorization.grantToken,
      context.actorId,
    );

    if (version !== undefined && grantPayload.version !== version) {
      throw new ForbiddenException('Requested version is not authorized');
    }

    const object = await this.storageService.getObjectStream(
      grantPayload.objectKey,
      range,
    );

    return {
      filename: grantPayload.filename,
      contentType: grantPayload.contentType,
      fileSize: (object as any).ContentLength,
      object,
    };
  }

  private assertCanUpload(ownerId: string, user: ServiceUser) {
    const actorId = buildActorId(user);
    const roles = user.roles ?? [];
    if (
      (!roles.includes('editor') && !roles.includes('admin')) ||
      (ownerId !== actorId && !roles.includes('admin'))
    ) {
      throw new ForbiddenException(
        'Only the owner editor or admin can upload document blobs',
      );
    }
  }

  private async readStreamToBuffer(stream: any): Promise<Buffer> {
    const chunks: Buffer[] = [];
    for await (const chunk of stream) {
      chunks.push(Buffer.from(chunk));
    }
    return Buffer.concat(chunks);
  }

  private async auditDownloadError(
    docId: string,
    context: RequestContext,
    error: unknown,
  ) {
    const axiosError = error as AxiosError<any>;
    const status = axiosError.response?.status;
    await this.auditClient.emitEvent(context, {
      action: 'DOCUMENT_DOWNLOAD_DENIED',
      resourceType: 'DOCUMENT',
      resourceId: docId,
      result:
        status === 409
          ? 'CONFLICT'
          : status && status >= 400 && status < 500
            ? 'DENY'
            : 'ERROR',
      reason:
        axiosError.response?.data?.message?.[0] ??
        axiosError.response?.data?.message ??
        (error as Error).message,
    });
  }
}
