import {
  ForbiddenException,
  Injectable,
  Logger,
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
  private readonly logger = new Logger(DocumentsService.name);

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
        // Use context.actorId — correct for both direct calls and gateway forwarded calls.
        ownerId: context.actorId,
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

    // Use context.actorId — correct even when req.user is stripped by gateway.
    this.assertCanManage(document.ownerId, context.actorId, context.roles);

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

  private assertCanManage(ownerId: string, actorId: string, roles: string[]) {
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

  // ── Approvers ────────────────────────────────────────────────────────────

  private approverCache: { ids: string[]; expiresAt: number } | null = null;
  private static readonly APPROVER_CACHE_TTL_MS = 60_000;

  /**
   * Returns user IDs for all users who have 'approver' or 'admin' role.
   *
   * Uses admin credentials (admin-cli client with password grant) to query
   * the Keycloak Admin REST API. Falls back gracefully if credentials are absent.
   *
   * Required env vars (already set in docker-compose infra):
   *   KEYCLOAK_BASE_URL   — e.g. http://localhost:8080
   *   KEYCLOAK_REALM      — e.g. docvault
   *   KEYCLOAK_ADMIN      — admin username (e.g. admin)
   *   KEYCLOAK_ADMIN_PASSWORD — admin password
   *
   * Cache: 60 seconds. If credentials are absent → { userIds: [] } (silent no-op).
   */
  async getApprovers(): Promise<{ userIds: string[] }> {
    const now = Date.now();

    if (this.approverCache && this.approverCache.expiresAt > now) {
      return { userIds: this.approverCache.ids };
    }

    const baseUrl    = process.env.KEYCLOAK_BASE_URL;
    const realm      = process.env.KEYCLOAK_REALM;
    const adminUser  = process.env.KEYCLOAK_ADMIN;
    const adminPass  = process.env.KEYCLOAK_ADMIN_PASSWORD;

    if (!baseUrl || !realm || !adminUser || !adminPass) {
      // Credentials not configured — silent no-op, don't block workflow
      this.approverCache = { ids: [], expiresAt: now + DocumentsService.APPROVER_CACHE_TTL_MS };
      return { userIds: [] };
    }

    try {
      // 1. Obtain admin access token from the master realm (admin-cli always lives there)
      const tokenRes = await fetch(
        `${baseUrl}/realms/master/protocol/openid-connect/token`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: new URLSearchParams({
            grant_type: 'password',
            client_id:  'admin-cli',
            username:   adminUser,
            password:   adminPass,
          }),
        },
      );

      if (!tokenRes.ok) throw new Error(`Token fetch failed: ${tokenRes.status}`);
      const { access_token } = await tokenRes.json() as { access_token: string };

      // 2. Fetch users by role in the docvault realm — parallel requests
      const [approverRes, adminRes] = await Promise.all([
        fetch(`${baseUrl}/admin/realms/${realm}/roles/approver/users?max=1000`, {
          headers: { Authorization: `Bearer ${access_token}` },
        }),
        fetch(`${baseUrl}/admin/realms/${realm}/roles/admin/users?max=1000`, {
          headers: { Authorization: `Bearer ${access_token}` },
        }),
      ]);

      if (!approverRes.ok || !adminRes.ok) throw new Error(`Role query failed`);

      const approverUsers: Array<{ id: string; username: string }> = await approverRes.json();
      const adminUsers:    Array<{ id: string; username: string }> = await adminRes.json();

      // Use sub (id/UUID) — NOT username.
      // Notifications are stored and retrieved by sub (UUID) to match req.user.sub in GET /notify.
      const ids = [
        ...new Set([
          ...approverUsers.map((u) => u.id).filter(Boolean),
          ...adminUsers.map((u) => u.id).filter(Boolean),
        ]),
      ];

      this.approverCache = { ids, expiresAt: now + DocumentsService.APPROVER_CACHE_TTL_MS };
      return { userIds: ids };
    } catch (err) {
      // Don't cache on failure — next submit() will retry automatically.
      // Only cache when credentials are permanently absent (not transient errors).
      this.logger.warn(
        `getApprovers() failed: ${(err as Error).message} — returning empty list (will retry on next submit)`,
      );
      return { userIds: [] };
    }
  }
}
