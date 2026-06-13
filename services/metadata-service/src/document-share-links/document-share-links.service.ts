import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { createHash, randomBytes } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { AuditClient } from '../audit/audit.client';
import { OrgService } from '../org/org.service';
import { RequestContext } from '../common/request-context';
import {
  CreateShareLinkDto,
  DocumentSharePermission,
} from './dto/create-share-link.dto';

const MAX_EXPIRY_HOURS = 720; // 30 days
const HOUR_MS = 60 * 60 * 1000;

export type ShareLinkStatus = 'ACTIVE' | 'EXPIRED' | 'REVOKED' | 'EXHAUSTED';

export interface ShareLinkView {
  id: string;
  docId: string;
  permission: DocumentSharePermission;
  createdBy: string;
  createdAt: string;
  expiresAt: string;
  maxAccessCount: number | null;
  accessCount: number;
  lastAccessedAt: string | null;
  revokedAt: string | null;
  revokedBy: string | null;
  status: ShareLinkStatus;
}

export interface ShareLinkRedeemResult {
  docId: string;
  permission: DocumentSharePermission;
  documentTitle: string;
  currentVersion: number;
  expiresAt: string;
}

@Injectable()
export class DocumentShareLinksService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditClient: AuditClient,
    private readonly orgService: OrgService,
  ) {}

  private get shareLinks() {
    return (this.prisma as any).documentShareLink;
  }

  private async findDocInOrgOrThrow(docId: string, context: RequestContext) {
    const organizationId = await this.orgService.requireOrgId(context.actorId);
    const document = await this.prisma.document.findFirst({
      where: { id: docId, organizationId },
    });
    if (!document) {
      throw new NotFoundException('Document not found');
    }
    return document;
  }

  async create(
    docId: string,
    dto: CreateShareLinkDto,
    context: RequestContext,
  ): Promise<ShareLinkView & { token: string }> {
    const expiresInHours = Number(dto.expiresInHours);
    if (
      !Number.isFinite(expiresInHours) ||
      expiresInHours < 1 ||
      expiresInHours > MAX_EXPIRY_HOURS
    ) {
      throw new BadRequestException('expiresInHours must be between 1 and 720');
    }

    const document = await this.findDocInOrgOrThrow(docId, context);

    this.assertCanManageShares(document.ownerId, context);

    const permission = dto.permission ?? DocumentSharePermission.VIEW;
    const token = randomBytes(32).toString('base64url');
    const tokenHash = hashToken(token);
    const expiresAt = new Date(Date.now() + expiresInHours * HOUR_MS);

    const created = await this.shareLinks.create({
      data: {
        docId,
        tokenHash,
        permission,
        createdBy: context.actorId,
        expiresAt,
        maxAccessCount: dto.maxAccessCount ?? null,
      },
    });

    await this.auditClient.emitEvent(context, {
      action: 'DOCUMENT_SHARE_LINK_CREATED',
      resourceType: 'DOCUMENT',
      resourceId: docId,
      result: 'SUCCESS',
      metadata: {
        shareLinkId: created.id,
        permission,
        expiresAt: expiresAt.toISOString(),
        maxAccessCount: dto.maxAccessCount ?? null,
      },
    });

    return { ...this.toView(created), token };
  }

  async list(docId: string, context: RequestContext): Promise<ShareLinkView[]> {
    const document = await this.findDocInOrgOrThrow(docId, context);
    this.assertCanManageShares(document.ownerId, context);

    const links = await this.shareLinks.findMany({
      where: { docId },
      orderBy: { createdAt: 'desc' },
    });
    return links.map((link: any) => this.toView(link));
  }

  async revoke(
    docId: string,
    linkId: string,
    context: RequestContext,
  ): Promise<ShareLinkView> {
    const document = await this.findDocInOrgOrThrow(docId, context);
    this.assertCanManageShares(document.ownerId, context);

    const link = await this.shareLinks.findUnique({ where: { id: linkId } });
    if (!link || link.docId !== docId) {
      throw new NotFoundException('Share link not found');
    }

    if (link.revokedAt) {
      return this.toView(link);
    }

    const updated = await this.shareLinks.update({
      where: { id: linkId },
      data: { revokedAt: new Date(), revokedBy: context.actorId },
    });

    await this.auditClient.emitEvent(context, {
      action: 'DOCUMENT_SHARE_LINK_REVOKED',
      resourceType: 'DOCUMENT',
      resourceId: docId,
      result: 'SUCCESS',
      metadata: { shareLinkId: linkId },
    });

    return this.toView(updated);
  }

  async redeem(
    token: string,
    context: RequestContext,
  ): Promise<ShareLinkRedeemResult> {
    const tokenHash = hashToken(token);
    const link = await this.shareLinks.findUnique({ where: { tokenHash } });
    if (!link) {
      throw new NotFoundException('Share link not found');
    }

    const status = computeStatus(link);
    if (status !== 'ACTIVE') {
      await this.auditClient.emitEvent(context, {
        action: 'DOCUMENT_SHARE_LINK_REDEEM_DENIED',
        resourceType: 'DOCUMENT',
        resourceId: link.docId,
        result: 'DENY',
        reason: status,
        metadata: { shareLinkId: link.id, status },
      });
      throw new ForbiddenException(`Share link is ${status.toLowerCase()}`);
    }

    const document = await this.prisma.document.findUnique({
      where: { id: link.docId },
    });
    if (!document) {
      throw new NotFoundException('Document not found');
    }

    await this.shareLinks.update({
      where: { id: link.id },
      data: { accessCount: { increment: 1 }, lastAccessedAt: new Date() },
    });

    await this.auditClient.emitEvent(context, {
      action: 'DOCUMENT_SHARE_LINK_REDEEMED',
      resourceType: 'DOCUMENT',
      resourceId: link.docId,
      result: 'SUCCESS',
      metadata: { shareLinkId: link.id, permission: link.permission },
    });

    return {
      docId: link.docId,
      permission: link.permission,
      documentTitle: document.title,
      currentVersion: document.currentVersion,
      expiresAt: new Date(link.expiresAt).toISOString(),
    };
  }

  private assertCanManageShares(ownerId: string, context: RequestContext) {
    const isAdmin = context.roles.includes('admin');
    const isOwnerEditor =
      ownerId === context.actorId &&
      (context.roles.includes('editor') || context.roles.includes('admin'));
    if (!isAdmin && !isOwnerEditor) {
      throw new ForbiddenException(
        'Only the owner editor or an admin can manage share links',
      );
    }
  }

  private toView(link: any): ShareLinkView {
    return {
      id: link.id,
      docId: link.docId,
      permission: link.permission,
      createdBy: link.createdBy,
      createdAt: toIso(link.createdAt),
      expiresAt: toIso(link.expiresAt),
      maxAccessCount: link.maxAccessCount ?? null,
      accessCount: link.accessCount ?? 0,
      lastAccessedAt: link.lastAccessedAt ? toIso(link.lastAccessedAt) : null,
      revokedAt: link.revokedAt ? toIso(link.revokedAt) : null,
      revokedBy: link.revokedBy ?? null,
      status: computeStatus(link),
    };
  }
}

function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

function toIso(value: Date | string): string {
  return value instanceof Date
    ? value.toISOString()
    : new Date(value).toISOString();
}

function computeStatus(link: any): ShareLinkStatus {
  if (link.revokedAt) return 'REVOKED';
  if (new Date(link.expiresAt).getTime() <= Date.now()) return 'EXPIRED';
  if (link.maxAccessCount != null && link.accessCount >= link.maxAccessCount) {
    return 'EXHAUSTED';
  }
  return 'ACTIVE';
}
