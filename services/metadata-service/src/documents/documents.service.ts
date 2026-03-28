import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ClassificationLevel, Document } from '../../generated/prisma';
import { AuditClient } from '../audit/audit.client';
import { CreateDocumentDto } from './dto/create-document.dto';
import { UpdateDocumentDto } from './dto/update-document.dto';
import {
  RequestContext,
  ServiceUser,
  buildActorId,
} from '../common/request-context';

@Injectable()
export class DocumentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditClient: AuditClient,
  ) {}

  /**
   * List documents with row-level ACL + classification filtering.
   *
   * The `userOrContext` parameter accepts either a ServiceUser (direct call)
   * or a RequestContext (when called via gateway proxy, where req.user is
   * stripped and user info is carried in x-user-id / x-roles headers).
   */
  findAll(userOrContext?: ServiceUser | RequestContext, searchQuery?: string) {
    let actorId: string;
    let roles: string[];
    let isAdmin: boolean;

    if (!userOrContext) {
      return [];
    }

    const isServiceUser = 'sub' in userOrContext;

    if (isServiceUser) {
      actorId = buildActorId(userOrContext);
      roles = userOrContext.roles ?? [];
    } else {
      actorId = userOrContext.actorId;
      roles = userOrContext.roles ?? [];
    }

    isAdmin = roles.includes('admin');

    // Build optional text search filter
    const searchFilter = searchQuery
      ? {
          OR: [
            { title: { contains: searchQuery, mode: 'insensitive' as const } },
            { description: { contains: searchQuery, mode: 'insensitive' as const } },
            { tags: { has: searchQuery } },
          ],
        }
      : undefined;

    if (isAdmin) {
      return this.prisma.document.findMany({
        where: {
          ...searchFilter,
          status: { not: 'DELETED' as const },
        },
        orderBy: { createdAt: 'desc' },
      });
    }

    return this.prisma.document.findMany({
      where: {
        AND: [
          // Search filter (optional)
          ...(searchFilter ? [searchFilter] : []),
          // Always exclude DELETED documents
          { status: { not: 'DELETED' as const } },
          // Visibility filter (role + classification based)
          {
            OR: [
          // Documents the user owns (always visible regardless of classification)
          { ownerId: actorId },
          // Documents where user has explicit ACL entry (DOWNLOAD permission)
          { aclEntries: { some: { subjectId: actorId } } },
          // Documents where user's role has ACL entry
          ...(roles.length > 0
            ? [{ aclEntries: { some: { subjectId: { in: roles } } } }]
            : []),
          // compliance_officer sees ALL published + archived documents (any classification) for audit
          ...(roles.includes('compliance_officer')
            ? [
                {
                  status: { in: ['PUBLISHED' as const, 'ARCHIVED' as const] },
                },
              ]
            : []),
          // PENDING: approver sees all pending documents to review
          ...(['approver', 'admin'].some((r) => roles.includes(r))
            ? [
                {
                  status: 'PENDING' as const,
                },
              ]
            : []),
          // DRAFT: viewer sees their own drafts to preview/download
          { ownerId: actorId, status: 'DRAFT' as const },
          // PUBLIC: any authenticated user sees PUBLISHED + PUBLIC
          ...(roles.some((r) =>
            ['viewer', 'editor', 'approver', 'compliance_officer', 'admin'].includes(r),
          )
            ? [
                {
                  status: 'PUBLISHED' as const,
                  classification: 'PUBLIC' as const,
                },
              ]
            : []),
          // INTERNAL: viewer+ sees PUBLISHED + INTERNAL (consistent with getClassificationDeniedReason)
          ...(['viewer', 'editor', 'approver', 'admin'].some((r) =>
            roles.includes(r),
          )
            ? [
                {
                  status: 'PUBLISHED' as const,
                  classification: 'INTERNAL' as const,
                },
              ]
            : []),
          // CONFIDENTIAL: approver+ sees PUBLISHED + CONFIDENTIAL
          ...(['approver', 'admin'].some((r) => roles.includes(r))
            ? [
                {
                  status: 'PUBLISHED' as const,
                  classification: 'CONFIDENTIAL' as const,
                },
              ]
            : []),
          // SECRET: approver+ sees PUBLISHED + SECRET
          ...(['approver', 'admin'].some((r) => roles.includes(r))
            ? [
                {
                  status: 'PUBLISHED' as const,
                  classification: 'SECRET' as const,
                },
              ]
            : []),
            ],
          },
        ],
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOneOrThrow(id: string) {
    const document = await this.prisma.document.findUnique({
      where: { id, status: { not: 'DELETED' as const } },
      include: {
        versions: { orderBy: { version: 'desc' } },
        aclEntries: true,
      },
    });

    if (!document) {
      throw new NotFoundException('Document not found');
    }

    return document;
  }

  async create(
    dto: CreateDocumentDto,
    user: ServiceUser,
    context: RequestContext,
  ) {
    const created = await this.prisma.document.create({
      data: {
        title: dto.title,
        description: dto.description,
        classification: (dto.classification ?? 'INTERNAL') as any,
        tags: this.sanitizeTags(dto.tags),
        ownerId: buildActorId(user),
      },
    });

    await this.auditClient.emitEvent(context, {
      action: 'DOCUMENT_CREATED',
      resourceType: 'DOCUMENT',
      resourceId: created.id,
      result: 'SUCCESS',
      metadata: {
        docId: created.id,
        title: created.title,
        classification: created.classification,
        tags: created.tags,
        ownerId: created.ownerId,
        createdAt: created.createdAt,
      },
    });

    return created;
  }

  async update(
    id: string,
    dto: UpdateDocumentDto,
    user: ServiceUser,
    context: RequestContext,
  ) {
    const document = await this.prisma.document.findUnique({
      where: { id },
    });

    if (!document) {
      throw new NotFoundException('Document not found');
    }

    this.assertCanManage(document.ownerId, user);

    const data: Record<string, any> = {};
    const changes: Record<string, { old: unknown; new: unknown }> = {};
    if (dto.title !== undefined) {
      changes.title = { old: document.title, new: dto.title };
      data.title = dto.title;
    }
    if (dto.description !== undefined) {
      changes.description = { old: document.description, new: dto.description };
      data.description = dto.description;
    }
    if (dto.classification !== undefined) {
      changes.classification = { old: document.classification, new: dto.classification };
      data.classification = dto.classification;
    }
    if (dto.tags !== undefined) {
      const newTags = this.sanitizeTags(dto.tags);
      changes.tags = { old: document.tags, new: newTags };
      data.tags = newTags;
    }

    const updated = await this.prisma.document.update({
      where: { id },
      data,
    });

    await this.auditClient.emitEvent(context, {
      action: 'DOCUMENT_METADATA_UPDATED',
      resourceType: 'DOCUMENT',
      resourceId: id,
      result: 'SUCCESS',
      metadata: {
        docId: id,
        changes,
        updatedAt: updated.updatedAt,
      },
    });

    return updated;
  }

  /** Trim, deduplicate, remove empty strings */
  private sanitizeTags(tags?: string[]): string[] {
    if (!tags) return [];
    return [...new Set(tags.map((t) => t.trim()).filter(Boolean))];
  }

  private assertCanManage(ownerId: string, user: ServiceUser) {
    const actorId = buildActorId(user);
    const roles = user.roles ?? [];
    const isEditor = roles.includes('editor') || roles.includes('admin');

    if (!isEditor || (ownerId !== actorId && !roles.includes('admin'))) {
      throw new ForbiddenException(
        'Only the owner editor or admin can mutate metadata',
      );
    }
  }

  /**
   * Soft-delete a document by marking it as DELETED.
   * Called exclusively by the workflow service after it has authorized the action.
   */
  async markDeleted(id: string): Promise<Document> {
    return this.prisma.document.update({
      where: { id, status: { not: 'DELETED' as const } },
      data: {
        status: 'DELETED' as any,
        deletedAt: new Date(),
      },
    });
  }
}
