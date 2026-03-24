import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
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
   * List documents with row-level ACL filtering.
   *
   * The `userOrContext` parameter accepts either a ServiceUser (direct call)
   * or a RequestContext (when called via gateway proxy, where req.user is
   * stripped and user info is carried in x-user-id / x-roles headers).
   */
  findAll(userOrContext?: ServiceUser | RequestContext) {
    let actorId: string;
    let roles: string[];
    let isAdmin: boolean;

    if (!userOrContext) {
      return [];
    }

    if ('roles' in userOrContext && !Array.isArray(userOrContext.roles)) {
      // It's a ServiceUser
      actorId = buildActorId(userOrContext);
      roles = userOrContext.roles ?? [];
    } else {
      // It's a RequestContext (from proxy)
      actorId = userOrContext.actorId;
      roles = userOrContext.roles ?? [];
    }

    isAdmin = roles.includes('admin');

    if (isAdmin) {
      return this.prisma.document.findMany({
        orderBy: { createdAt: 'desc' },
      });
    }

    return this.prisma.document.findMany({
      where: {
        OR: [
          // Documents the user owns
          { ownerId: actorId },
          // Documents where user has explicit ACL entry
          { aclEntries: { some: { subjectId: actorId } } },
          // Documents where user's role has ACL entry
          ...(roles.length > 0
            ? [{ aclEntries: { some: { subjectId: { in: roles } } } }]
            : []),
          // Published documents visible to default reader roles
          {
            status: 'PUBLISHED',
            aclEntries: { some: { subjectType: 'ALL' as const } },
          },
          // All published documents for known roles
          ...(['viewer', 'editor', 'approver'].some((r) => roles.includes(r))
            ? [{ status: 'PUBLISHED' }]
            : []),
        ],
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOneOrThrow(id: string) {
    const document = await this.prisma.document.findUnique({
      where: { id },
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
    if (dto.title !== undefined) data.title = dto.title;
    if (dto.description !== undefined) data.description = dto.description;
    if (dto.classification !== undefined)
      data.classification = dto.classification;
    if (dto.tags !== undefined) data.tags = this.sanitizeTags(dto.tags);

    const updated = await this.prisma.document.update({
      where: { id },
      data,
    });

    await this.auditClient.emitEvent(context, {
      action: 'DOCUMENT_METADATA_UPDATED',
      resourceType: 'DOCUMENT',
      resourceId: id,
      result: 'SUCCESS',
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
}
