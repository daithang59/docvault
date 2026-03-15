import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { StorageService } from '../storage/storage.service';
import { CreateDocumentDto } from './dto/create-document.dto';
import { UploadDocumentDto } from './dto/upload-document.dto';

@Injectable()
export class DocumentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
  ) {}

  findAll() {
    return this.prisma.documentMetadata.findMany({
      orderBy: { createdAt: 'desc' },
    });
  }

  findOne(id: string) {
    return this.prisma.documentMetadata.findUnique({ where: { id } });
  }

  create(dto: CreateDocumentDto, user: { sub: string; username?: string }) {
    return this.prisma.documentMetadata.create({
      data: {
        title: dto.title,
        description: dto.description,
        filename: dto.filename,
        contentType: dto.contentType,
        ownerId: user.username ?? user.sub,
      },
    });
  }

  async uploadDocument(
    dto: UploadDocumentDto,
    file: Express.Multer.File | undefined,
    user: { sub: string; username?: string },
  ) {
    if (!file) throw new BadRequestException('File is required');

    const objectKey = this.storage.buildObjectKey(file.originalname);

    const uploaded = await this.storage.upload({
      objectKey,
      body: file.buffer,
      contentType: file.mimetype,
      metadata: { owner: user.username ?? user.sub },
    });

    return this.prisma.documentMetadata.create({
      data: {
        title: dto.title,
        description: dto.description,
        ownerId: user.username ?? user.sub,
        filename: file.originalname,
        contentType: file.mimetype,
        sizeBytes: file.size,
        bucket: uploaded.bucket,
        objectKey: uploaded.objectKey,
        etag: uploaded.etag?.replaceAll('"', '') ?? null,
      },
    });
  }

  /** CO gets audit/compliance view only — cannot download blobs */
  private canDownload(
    doc: { ownerId: string },
    user: { username?: string; sub: string; roles?: string[] },
  ): boolean {
    const roles = user.roles ?? [];
    const isOwner = doc.ownerId === (user.username ?? user.sub);
    const isPrivileged = roles.some((r) =>
      ['admin', 'approver', 'editor', 'viewer'].includes(r),
    );
    const isComplianceOnly = roles.includes('co');
    return (isOwner || isPrivileged) && !isComplianceOnly;
  }

  async getDownloadUrl(
    id: string,
    user: { username?: string; sub: string; roles?: string[] },
  ) {
    const doc = await this.findOne(id);
    if (!doc) throw new NotFoundException('Document not found');
    if (!this.canDownload(doc, user)) {
      throw new ForbiddenException('You are not allowed to download this file');
    }

    const url = await this.storage.createDownloadUrl({
      objectKey: doc.objectKey,
      filename: doc.filename,
      expiresInSeconds: 300,
    });

    return { id: doc.id, filename: doc.filename, expiresInSeconds: 300, url };
  }

  async getDownloadStream(
    id: string,
    user: { username?: string; sub: string; roles?: string[] },
  ) {
    const doc = await this.findOne(id);
    if (!doc) throw new NotFoundException('Document not found');
    if (!this.canDownload(doc, user)) {
      throw new ForbiddenException('You are not allowed to download this file');
    }

    return {
      doc,
      object: await this.storage.getObjectStream(doc.objectKey!),
    };
  }
}
