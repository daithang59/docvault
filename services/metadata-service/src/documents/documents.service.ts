import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { StorageService } from '../storage/storage.service';
import { AuditService } from '../audit/audit.service';
import { CreateDocumentDto } from './dto/create-document.dto';
import { UploadDocumentDto } from './dto/upload-document.dto';

@Injectable()
export class DocumentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
    private readonly audit: AuditService,
  ) {}

  findAll() {
    return this.prisma.documentMetadata.findMany({
      orderBy: { createdAt: 'desc' },
    });
  }

  findOne(id: string) {
    return this.prisma.documentMetadata.findUnique({ where: { id } });
  }

  async create(
    dto: CreateDocumentDto,
    user: { sub: string; username?: string; roles?: string[] },
  ) {
    return this.prisma.$transaction(async (tx) => {
      const created = await tx.documentMetadata.create({
        data: {
          title: dto.title,
          description: dto.description,
          filename: dto.filename,
          contentType: dto.contentType,
          ownerId: user.username ?? user.sub,
        },
      });

      await this.audit.log(tx, {
        documentId: created.id,
        actorId: user.username ?? user.sub,
        actorRole: user.roles?.[0] ?? null,
        action: 'DOCUMENT_CREATED',
        toStatus: created.status,
        detail: 'Metadata record created',
      });

      return created;
    });
  }

  async uploadDocument(
    dto: UploadDocumentDto,
    file: Express.Multer.File | undefined,
    user: { sub: string; username?: string; roles?: string[] },
  ) {
    if (!file) throw new BadRequestException('File is required');

    const objectKey = this.storage.buildObjectKey(file.originalname);

    const uploaded = await this.storage.upload({
      objectKey,
      body: file.buffer,
      contentType: file.mimetype,
      metadata: { owner: user.username ?? user.sub },
    });

    return this.prisma.$transaction(async (tx) => {
      const created = await tx.documentMetadata.create({
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

      await this.audit.log(tx, {
        documentId: created.id,
        actorId: user.username ?? user.sub,
        actorRole: user.roles?.[0] ?? null,
        action: 'DOCUMENT_UPLOADED',
        toStatus: created.status,
        detail: `Uploaded ${file.originalname}`,
      });

      return created;
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

  private hasAnyRole(
    user: { roles?: string[] },
    expected: string[],
  ): boolean {
    const roles = user.roles ?? [];
    return expected.some((r) => roles.includes(r));
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

    await this.audit.log(this.prisma, {
      documentId: doc.id,
      actorId: user.username ?? user.sub,
      actorRole: user.roles?.[0] ?? null,
      action: 'DOCUMENT_DOWNLOAD_URL_ISSUED',
      fromStatus: doc.status,
      toStatus: doc.status,
      detail: 'Issued 5-minute presigned URL',
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

  // ──────────── Workflow methods ────────────

  async submitForApproval(
    id: string,
    user: { username?: string; sub: string; roles?: string[] },
  ) {
    const doc = await this.findOne(id);
    if (!doc) throw new NotFoundException('Document not found');

    const isOwner = doc.ownerId === (user.username ?? user.sub);
    const canSubmit = this.hasAnyRole(user, ['editor', 'admin']) && isOwner;

    if (!canSubmit) {
      throw new ForbiddenException(
        'Only the owner editor/admin can submit this document',
      );
    }

    if (doc.status !== 'DRAFT') {
      throw new BadRequestException('Only DRAFT documents can be submitted');
    }

    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.documentMetadata.update({
        where: { id },
        data: { status: 'PENDING_APPROVAL', version: { increment: 1 } },
      });

      await this.audit.log(tx, {
        documentId: id,
        actorId: user.username ?? user.sub,
        actorRole: user.roles?.[0] ?? null,
        action: 'DOCUMENT_SUBMITTED',
        fromStatus: doc.status,
        toStatus: updated.status,
        detail: 'Submitted for approval',
      });

      return updated;
    });
  }

  async approve(
    id: string,
    user: { username?: string; sub: string; roles?: string[] },
  ) {
    const doc = await this.findOne(id);
    if (!doc) throw new NotFoundException('Document not found');

    if (!this.hasAnyRole(user, ['approver', 'admin'])) {
      throw new ForbiddenException('Only approver/admin can approve');
    }

    if (doc.status !== 'PENDING_APPROVAL') {
      throw new BadRequestException(
        'Only PENDING_APPROVAL documents can be approved',
      );
    }

    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.documentMetadata.update({
        where: { id },
        data: { status: 'APPROVED', version: { increment: 1 } },
      });

      await this.audit.log(tx, {
        documentId: id,
        actorId: user.username ?? user.sub,
        actorRole: user.roles?.[0] ?? null,
        action: 'DOCUMENT_APPROVED',
        fromStatus: doc.status,
        toStatus: updated.status,
        detail: 'Approved by approver/admin',
      });

      return updated;
    });
  }

  async reject(
    id: string,
    user: { username?: string; sub: string; roles?: string[] },
    reason?: string,
  ) {
    const doc = await this.findOne(id);
    if (!doc) throw new NotFoundException('Document not found');

    if (!this.hasAnyRole(user, ['approver', 'admin'])) {
      throw new ForbiddenException('Only approver/admin can reject');
    }

    if (doc.status !== 'PENDING_APPROVAL') {
      throw new BadRequestException(
        'Only PENDING_APPROVAL documents can be rejected',
      );
    }

    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.documentMetadata.update({
        where: { id },
        data: { status: 'REJECTED', version: { increment: 1 } },
      });

      await this.audit.log(tx, {
        documentId: id,
        actorId: user.username ?? user.sub,
        actorRole: user.roles?.[0] ?? null,
        action: 'DOCUMENT_REJECTED',
        fromStatus: doc.status,
        toStatus: updated.status,
        detail: reason ?? 'Rejected without reason',
      });

      return updated;
    });
  }

  async archive(
    id: string,
    user: { username?: string; sub: string; roles?: string[] },
  ) {
    const doc = await this.findOne(id);
    if (!doc) throw new NotFoundException('Document not found');

    if (!this.hasAnyRole(user, ['admin'])) {
      throw new ForbiddenException('Only admin can archive');
    }

    if (!['APPROVED', 'REJECTED'].includes(doc.status)) {
      throw new BadRequestException(
        'Only APPROVED or REJECTED documents can be archived',
      );
    }

    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.documentMetadata.update({
        where: { id },
        data: { status: 'ARCHIVED', version: { increment: 1 } },
      });

      await this.audit.log(tx, {
        documentId: id,
        actorId: user.username ?? user.sub,
        actorRole: user.roles?.[0] ?? null,
        action: 'DOCUMENT_ARCHIVED',
        fromStatus: doc.status,
        toStatus: updated.status,
        detail: 'Archived by admin',
      });

      return updated;
    });
  }

  listAudit(id: string) {
    return this.audit.listForDocument(id);
  }
}
