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

@Injectable()
export class DocumentsService {
  constructor(
    private readonly metadataClient: MetadataClient,
    private readonly storageService: StorageService,
    private readonly auditClient: AuditClient,
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

    await this.auditClient.emitEvent(context, {
      action: 'DOCUMENT_UPLOADED',
      resourceType: 'DOCUMENT',
      resourceId: docId,
      result: 'SUCCESS',
    });

    return {
      ...versionRecord,
      checksum,
      objectKey,
    };
  }

  async presignDownload(
    docId: string,
    dto: PresignDownloadDto,
    context: RequestContext,
  ) {
    try {
      const authorization = await this.metadataClient.authorizeDownload(
        docId,
        { version: dto.version },
        context,
      );
      const grantPayload = verifyGrantToken(authorization.grantToken);
      const url = await this.storageService.createDownloadUrl({
        objectKey: grantPayload.objectKey,
        filename: grantPayload.filename,
        expiresInSeconds: authorization.expiresInSeconds,
      });

      await this.auditClient.emitEvent(context, {
        action: 'DOCUMENT_DOWNLOAD_URL_ISSUED',
        resourceType: 'DOCUMENT',
        resourceId: docId,
        result: 'SUCCESS',
      });

      return {
        docId,
        version: grantPayload.version,
        filename: grantPayload.filename,
        expiresAt: authorization.expiresAt,
        expiresInSeconds: authorization.expiresInSeconds,
        url,
      };
    } catch (error) {
      await this.auditDownloadError(docId, context, error);
      throw error;
    }
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
      const grantPayload = verifyGrantToken(authorization.grantToken);

      if (grantPayload.version !== version) {
        throw new ForbiddenException('Requested version is not authorized');
      }

      const object = await this.storageService.getObjectStream(
        grantPayload.objectKey,
      );

      await this.auditClient.emitEvent(context, {
        action: 'DOCUMENT_DOWNLOADED',
        resourceType: 'DOCUMENT',
        resourceId: docId,
        result: 'SUCCESS',
      });

      return {
        filename: grantPayload.filename,
        contentType: grantPayload.contentType,
        stream: new StreamableFile(object.Body as any),
      };
    } catch (error) {
      await this.auditDownloadError(docId, context, error);
      throw error;
    }
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
      result: status === 409 ? 'CONFLICT' : status && status >= 400 && status < 500 ? 'DENY' : 'ERROR',
      reason:
        axiosError.response?.data?.message?.[0] ??
        axiosError.response?.data?.message ??
        (error as Error).message,
    });
  }
}
