import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Document, Prisma } from '../../generated/prisma';
import { AuditClient } from '../audit/audit.client';
import { CreateDocumentDto } from './dto/create-document.dto';
import { UpdateDocumentDto } from './dto/update-document.dto';
import {
  RequestContext,
  ServiceUser,
  buildActorId,
  normalizeGroups,
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
    let groups: string[];

    if (!userOrContext) {
      return [];
    }

    const isServiceUser = 'sub' in userOrContext;

    if (isServiceUser) {
      actorId = buildActorId(userOrContext);
      roles = userOrContext.roles ?? [];
      groups = normalizeGroups(userOrContext.groups);
    } else {
      actorId = userOrContext.actorId;
      roles = userOrContext.roles ?? [];
      groups = normalizeGroups(userOrContext.groups);
    }

    const isAdmin = roles.includes('admin');

    const searchFilter = this.buildDocumentSearchFilter(searchQuery);

    const groupSubjectIds = [
      ...new Set(groups.flatMap((group) => [group, `/${group}`])),
    ];

    const aclSubjects = [
      {
        subjectType: 'ALL' as const,
        subjectId: null,
      },
      {
        subjectType: 'USER' as const,
        subjectId: actorId,
      },
      ...roles.map((role) => ({
        subjectType: 'ROLE' as const,
        subjectId: role,
      })),
      ...groupSubjectIds.map((group) => ({
        subjectType: 'GROUP' as const,
        subjectId: group,
      })),
    ];

    const matchingReadAcl = {
      permission: 'READ' as const,
      OR: aclSubjects,
    };

    const readDenyFilter = {
      NOT: {
        aclEntries: {
          some: {
            ...matchingReadAcl,
            effect: 'DENY' as const,
          },
        },
      },
    };

    if (isAdmin) {
      return this.prisma.document
        .findMany({
          where: {
            AND: [
              ...(searchFilter ? [searchFilter] : []),
              { status: { not: 'DELETED' as const } },
              readDenyFilter,
            ],
          },
          orderBy: { createdAt: 'desc' },
          include: this.latestVersionInclude(),
        })
        .then((documents) =>
          documents.map((document) => this.toListSummary(document)),
        );
    }

    return this.prisma.document
      .findMany({
        where: {
          AND: [
            // Search filter (optional)
            ...(searchFilter ? [searchFilter] : []),
            // Always exclude DELETED documents
            { status: { not: 'DELETED' as const } },
            // Explicit ACL DENY overrides baseline role/classification visibility.
            readDenyFilter,
            // Visibility filter (role + classification based)
            {
              OR: [
                // Documents the user owns (always visible regardless of classification)
                { ownerId: actorId },
                // Documents where user/role/group/all has explicit READ allow.
                {
                  aclEntries: {
                    some: {
                      ...matchingReadAcl,
                      effect: 'ALLOW' as const,
                    },
                  },
                },
                // compliance_officer sees ALL published + archived documents (any classification) for audit
                ...(roles.includes('compliance_officer')
                  ? [
                      {
                        status: {
                          in: ['PUBLISHED' as const, 'ARCHIVED' as const],
                        },
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
                  [
                    'viewer',
                    'editor',
                    'approver',
                    'compliance_officer',
                    'admin',
                  ].includes(r),
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
        include: this.latestVersionInclude(),
      })
      .then((documents) =>
        documents.map((document) => this.toListSummary(document)),
      );
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
      if (
        (document as any).dlpStatus === 'DETECTED' &&
        ['PUBLIC', 'INTERNAL'].includes(dto.classification)
      ) {
        const overrideReason = dto.classificationOverrideReason?.trim();
        const isAdmin = context.roles.includes('admin');

        if (!isAdmin) {
          await this.auditClient.emitEvent(context, {
            action: 'DLP_CLASSIFICATION_DOWNGRADE_DENIED',
            resourceType: 'DOCUMENT',
            resourceId: id,
            result: 'DENY',
            reason:
              'DLP-detected documents cannot be downgraded below CONFIDENTIAL',
            metadata: {
              docId: id,
              currentClassification: document.classification,
              requestedClassification: dto.classification,
              dlpStatus: (document as any).dlpStatus,
            },
          });
          throw new ForbiddenException(
            'DLP-detected documents cannot be downgraded below CONFIDENTIAL',
          );
        }

        if (!overrideReason) {
          await this.auditClient.emitEvent(context, {
            action: 'DLP_CLASSIFICATION_DOWNGRADE_DENIED',
            resourceType: 'DOCUMENT',
            resourceId: id,
            result: 'DENY',
            reason:
              'Admin override reason is required for DLP classification downgrade',
            metadata: {
              docId: id,
              currentClassification: document.classification,
              requestedClassification: dto.classification,
              dlpStatus: (document as any).dlpStatus,
            },
          });
          throw new BadRequestException(
            'Admin override reason is required for DLP classification downgrade',
          );
        }

        await this.auditClient.emitEvent(context, {
          action: 'DLP_CLASSIFICATION_OVERRIDE_APPROVED',
          resourceType: 'DOCUMENT',
          resourceId: id,
          result: 'SUCCESS',
          reason: overrideReason,
          metadata: {
            docId: id,
            currentClassification: document.classification,
            requestedClassification: dto.classification,
            dlpStatus: (document as any).dlpStatus,
            overrideReason,
          },
        });
      }
      changes.classification = {
        old: document.classification,
        new: dto.classification,
      };
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

  private buildDocumentSearchFilter(
    searchQuery?: string,
  ): Prisma.DocumentWhereInput | undefined {
    const query = parseDocumentListSearch(searchQuery);
    const filters: Prisma.DocumentWhereInput[] = [];

    for (const term of query.freeText) {
      filters.push(this.buildTextSearchFilter(term));
    }

    for (const status of query.status) {
      const statusValue = findEnumValue(DOCUMENT_STATUSES, status);
      if (statusValue) {
        filters.push({ status: statusValue });
      }
    }

    for (const classification of query.classification) {
      const classificationValue = findEnumValue(
        DOCUMENT_CLASSIFICATIONS,
        classification,
      );
      if (classificationValue) {
        filters.push({ classification: classificationValue });
      }
    }

    for (const owner of query.owner) {
      filters.push({
        ownerId: { contains: owner, mode: 'insensitive' },
      });
    }

    for (const tag of [...query.tag, ...query.folder]) {
      filters.push({ tags: { has: tag } });
    }

    for (const filename of query.file) {
      filters.push({
        versions: {
          some: {
            filename: { contains: filename, mode: 'insensitive' },
          },
        },
      });
    }

    for (const presence of query.presence) {
      const presenceFilter = buildPresenceFilter(presence);
      if (presenceFilter) filters.push(presenceFilter);
    }

    for (const dlpStatus of query.dlp) {
      const dlpStatusFilter = buildDlpStatusFilter(dlpStatus);
      if (dlpStatusFilter) filters.push(dlpStatusFilter);
    }

    for (const retention of query.retention) {
      const retentionFilter = buildRetentionFilter(retention);
      if (retentionFilter) filters.push(retentionFilter);
    }

    for (const range of query.dateRanges) {
      filters.push(buildDateRangeFilter(range));
    }

    if (filters.length === 0) return undefined;
    if (filters.length === 1) return filters[0];
    return { AND: filters };
  }

  private buildTextSearchFilter(term: string): Prisma.DocumentWhereInput {
    return {
      OR: [
        { title: { contains: term, mode: 'insensitive' } },
        {
          description: {
            contains: term,
            mode: 'insensitive',
          },
        },
        { tags: { has: term } },
        {
          versions: {
            some: {
              filename: {
                contains: term,
                mode: 'insensitive',
              },
            },
          },
        },
      ],
    };
  }

  private latestVersionInclude() {
    return {
      versions: {
        orderBy: { version: 'desc' as const },
        take: 1,
      },
    };
  }

  private toListSummary(
    document: Document & {
      versions?: Array<{
        filename: string;
        contentType?: string | null;
        size: number;
      }>;
    },
  ) {
    const { versions, ...summary } = document;
    const latestVersion = versions?.[0];

    if (!latestVersion) return summary;

    return {
      ...summary,
      filename: latestVersion.filename,
      contentType: latestVersion.contentType,
      mimeType: latestVersion.contentType ?? undefined,
      fileSize: latestVersion.size,
    };
  }

  /**
   * Place or release a legal hold on a document.
   *
   * Legal hold is a compliance control: while active, the retention job will
   * never auto-archive the document. Only admins can change a hold, and placing
   * a hold requires a reason for the audit trail.
   */
  async setLegalHold(
    id: string,
    input: { hold: boolean; reason?: string },
    context: RequestContext,
  ): Promise<Document> {
    if (!context.roles.includes('admin')) {
      throw new ForbiddenException('Only admins can change legal hold');
    }

    const document = await this.prisma.document.findUnique({ where: { id } });
    if (!document) {
      throw new NotFoundException('Document not found');
    }

    const reason = input.reason?.trim();
    if (input.hold && !reason) {
      throw new BadRequestException('A reason is required to place a legal hold');
    }

    const now = new Date();
    const data = input.hold
      ? {
          legalHold: true,
          legalHoldReason: reason ?? null,
          legalHoldBy: context.actorId,
          legalHoldAt: now,
        }
      : {
          legalHold: false,
          legalHoldReason: null,
          legalHoldBy: null,
          legalHoldAt: null,
        };

    const updated = await this.prisma.document.update({
      where: { id },
      data,
    });

    await this.auditClient.emitEvent(context, {
      action: input.hold
        ? 'DOCUMENT_LEGAL_HOLD_PLACED'
        : 'DOCUMENT_LEGAL_HOLD_RELEASED',
      resourceType: 'DOCUMENT',
      resourceId: id,
      result: 'SUCCESS',
      reason: input.hold ? reason : 'Legal hold released',
      metadata: {
        docId: id,
        legalHold: input.hold,
        ...(input.hold && reason ? { legalHoldReason: reason } : {}),
      },
    });

    return updated;
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
   * Trash recovery window: a DELETED document can be restored within this many
   * days of deletion before it is considered permanently purged.
   */
  private readonly trashRecoveryDays = 30;

  /**
   * List soft-deleted documents. Owners/editors see their own trash; admins see
   * all. Each entry carries a recovery deadline so the UI can warn before purge.
   */
  async listTrash(context: RequestContext, now: Date = new Date()) {
    const isAdmin = context.roles.includes('admin');
    const where: Record<string, unknown> = { status: 'DELETED' as const };
    if (!isAdmin) {
      where.ownerId = context.actorId;
    }

    const documents = await this.prisma.document.findMany({
      where: where as any,
      orderBy: { deletedAt: 'desc' } as any,
    });

    const dayMs = 24 * 60 * 60 * 1000;
    return documents.map((doc: any) => {
      const deletedAt: Date | null = doc.deletedAt ?? null;
      const purgeAt = deletedAt
        ? new Date(deletedAt.getTime() + this.trashRecoveryDays * dayMs)
        : null;
      const daysUntilPurge = purgeAt
        ? Math.ceil((purgeAt.getTime() - now.getTime()) / dayMs)
        : null;
      return {
        docId: doc.id,
        title: doc.title,
        ownerId: doc.ownerId,
        classification: doc.classification,
        deletedAt: deletedAt ? deletedAt.toISOString() : null,
        purgeAt: purgeAt ? purgeAt.toISOString() : null,
        daysUntilPurge,
        recoverable: daysUntilPurge != null && daysUntilPurge > 0,
      };
    });
  }

  /**
   * Restore a soft-deleted document back to DRAFT, if still within the recovery
   * window and the actor owns it (or is admin).
   */
  async restoreFromTrash(
    id: string,
    context: RequestContext,
    now: Date = new Date(),
  ): Promise<Document> {
    const document = await this.prisma.document.findUnique({ where: { id } });
    if (!document) {
      throw new NotFoundException('Document not found');
    }
    if (document.status !== 'DELETED') {
      throw new BadRequestException('Only deleted documents can be restored');
    }

    const isAdmin = context.roles.includes('admin');
    if (!isAdmin && document.ownerId !== context.actorId) {
      throw new ForbiddenException(
        'Only the owner or an admin can restore this document',
      );
    }

    const dayMs = 24 * 60 * 60 * 1000;
    const deletedAt: Date | null = (document as any).deletedAt ?? null;
    if (deletedAt) {
      const purgeAt = new Date(
        deletedAt.getTime() + this.trashRecoveryDays * dayMs,
      );
      if (now.getTime() > purgeAt.getTime()) {
        throw new BadRequestException(
          'The recovery window for this document has elapsed',
        );
      }
    }

    const restored = await this.prisma.document.update({
      where: { id },
      data: { status: 'DRAFT' as any, deletedAt: null } as any,
    });

    await this.auditClient.emitEvent(context, {
      action: 'DOCUMENT_RESTORED_FROM_TRASH',
      resourceType: 'DOCUMENT',
      resourceId: id,
      result: 'SUCCESS',
      metadata: { docId: id, restoredTo: 'DRAFT' },
    });

    return restored;
  }
  /**
   * Define an ordered list of approvers for a document. Resets progress to the
   * first step. Only the owner editor or an admin can configure the chain.
   */
  async setApprovalChain(
    id: string,
    input: { approvers: string[] },
    context: RequestContext,
  ): Promise<Document> {
    const document = await this.prisma.document.findUnique({ where: { id } });
    if (!document) {
      throw new NotFoundException('Document not found');
    }

    const isAdmin = context.roles.includes('admin');
    const isOwnerEditor =
      document.ownerId === context.actorId &&
      (context.roles.includes('editor') || context.roles.includes('admin'));
    if (!isAdmin && !isOwnerEditor) {
      throw new ForbiddenException(
        'Only the owner editor or an admin can configure the approval chain',
      );
    }

    const approvers = (input.approvers ?? [])
      .map((value) => value.trim())
      .filter(Boolean);
    if (approvers.length === 0) {
      throw new BadRequestException('Approval chain must have at least one approver');
    }
    if (new Set(approvers).size !== approvers.length) {
      throw new BadRequestException('Approval chain cannot contain duplicates');
    }

    const updated = await this.prisma.document.update({
      where: { id },
      data: { approvalChain: approvers, approvalStep: 0 } as any,
    });

    await this.auditClient.emitEvent(context, {
      action: 'DOCUMENT_APPROVAL_CHAIN_SET',
      resourceType: 'DOCUMENT',
      resourceId: id,
      result: 'SUCCESS',
      metadata: { docId: id, approverCount: approvers.length },
    });

    return updated;
  }

  /**
   * Advance the approval chain to the next step. Called by workflow-service after
   * a valid step approval. Returns the updated document.
   */
  async advanceApprovalStep(
    id: string,
    context: RequestContext,
  ): Promise<Document> {
    const document = await this.prisma.document.findUnique({ where: { id } });
    if (!document) {
      throw new NotFoundException('Document not found');
    }
    const nextStep = ((document as any).approvalStep ?? 0) + 1;
    return this.prisma.document.update({
      where: { id },
      data: { approvalStep: nextStep } as any,
    });
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

    const baseUrl = process.env.KEYCLOAK_BASE_URL;
    const realm = process.env.KEYCLOAK_REALM;
    const adminUser = process.env.KEYCLOAK_ADMIN;
    const adminPass = process.env.KEYCLOAK_ADMIN_PASSWORD;

    if (!baseUrl || !realm || !adminUser || !adminPass) {
      // Credentials not configured — silent no-op, don't block workflow
      this.approverCache = {
        ids: [],
        expiresAt: now + DocumentsService.APPROVER_CACHE_TTL_MS,
      };
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
            client_id: 'admin-cli',
            username: adminUser,
            password: adminPass,
          }),
        },
      );

      if (!tokenRes.ok)
        throw new Error(`Token fetch failed: ${tokenRes.status}`);
      const { access_token } = (await tokenRes.json()) as {
        access_token: string;
      };

      // 2. Fetch users by role in the docvault realm — parallel requests
      const [approverRes, adminRes] = await Promise.all([
        fetch(
          `${baseUrl}/admin/realms/${realm}/roles/approver/users?max=1000`,
          {
            headers: { Authorization: `Bearer ${access_token}` },
          },
        ),
        fetch(`${baseUrl}/admin/realms/${realm}/roles/admin/users?max=1000`, {
          headers: { Authorization: `Bearer ${access_token}` },
        }),
      ]);

      if (!approverRes.ok || !adminRes.ok) throw new Error(`Role query failed`);

      const approverUsers: Array<{ id: string; username: string }> =
        await approverRes.json();
      const adminUsers: Array<{ id: string; username: string }> =
        await adminRes.json();

      // Use sub (id/UUID) — NOT username.
      // Notifications are stored and retrieved by sub (UUID) to match req.user.sub in GET /notify.
      const ids = [
        ...new Set([
          ...approverUsers.map((u) => u.id).filter(Boolean),
          ...adminUsers.map((u) => u.id).filter(Boolean),
        ]),
      ];

      this.approverCache = {
        ids,
        expiresAt: now + DocumentsService.APPROVER_CACHE_TTL_MS,
      };
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

type DocumentDateField = 'createdAt' | 'updatedAt' | 'retentionUntil';

interface ParsedDocumentListSearch {
  freeText: string[];
  status: string[];
  classification: string[];
  owner: string[];
  tag: string[];
  folder: string[];
  file: string[];
  presence: string[];
  dlp: string[];
  retention: string[];
  dateRanges: DocumentDateRangeQuery[];
}

interface DocumentDateRangeQuery {
  field: DocumentDateField;
  from?: Date;
  to?: Date;
}

const DOCUMENT_STATUSES = [
  'DRAFT',
  'PENDING',
  'PUBLISHED',
  'ARCHIVED',
  'DELETED',
] as const;

const DOCUMENT_CLASSIFICATIONS = [
  'PUBLIC',
  'INTERNAL',
  'CONFIDENTIAL',
  'SECRET',
] as const;

const DUE_SOON_DAYS = 30;
const DAY_MS = 24 * 60 * 60 * 1000;

function parseDocumentListSearch(
  searchQuery?: string,
): ParsedDocumentListSearch {
  const query: ParsedDocumentListSearch = {
    freeText: [],
    status: [],
    classification: [],
    owner: [],
    tag: [],
    folder: [],
    file: [],
    presence: [],
    dlp: [],
    retention: [],
    dateRanges: [],
  };
  const search = searchQuery?.trim();
  if (!search) return query;

  const tokenPattern = /(\w+):"([^"]+)"|(\w+):(\S+)|"([^"]+)"|(\S+)/g;

  for (const match of search.matchAll(tokenPattern)) {
    const rawKey = match[1] ?? match[3];
    const rawValue = match[2] ?? match[4] ?? match[5] ?? match[6] ?? '';
    const value = rawValue.trim();
    if (!value) continue;

    const key = normalizeText(rawKey);
    if (key === 'status') {
      query.status.push(value);
    } else if (key === 'class' || key === 'classification') {
      query.classification.push(value);
    } else if (key === 'owner') {
      query.owner.push(value);
    } else if (key === 'tag') {
      query.tag.push(value);
    } else if (key === 'folder') {
      query.folder.push(value);
    } else if (key === 'file' || key === 'filename') {
      query.file.push(value);
    } else if (key === 'has') {
      query.presence.push(value);
    } else if (key === 'dlp') {
      query.dlp.push(value);
    } else if (key === 'retention') {
      query.retention.push(value);
    } else if (
      key === 'created' ||
      key === 'updated' ||
      key === 'retentionuntil'
    ) {
      const dateRange = parseDateRangeQuery(key, value);
      if (dateRange) query.dateRanges.push(dateRange);
    } else {
      query.freeText.push(rawKey ? `${rawKey}:${value}` : value);
    }
  }

  return query;
}

function buildPresenceFilter(
  operator: string,
): Prisma.DocumentWhereInput | null {
  const normalized = normalizeEnumText(operator);
  if (normalized === 'file' || normalized === 'files') {
    return { versions: { some: {} } };
  }
  if (normalized === 'retention') {
    return {
      OR: [
        { retentionClass: { not: null } },
        { retentionUntil: { not: null } },
      ],
    };
  }
  if (normalized === 'dlp') {
    return { dlpStatus: 'DETECTED' };
  }
  if (normalized === 'legalhold' || normalized === 'hold') {
    return { legalHold: true };
  }
  return null;
}

function buildDlpStatusFilter(
  operator: string,
): Prisma.DocumentWhereInput | null {
  const normalized = normalizeEnumText(operator);
  if (normalized === 'detected') return { dlpStatus: 'DETECTED' };
  if (normalized === 'clear') return { dlpStatus: 'CLEAR' };
  if (normalized === 'notscanned') return { dlpStatus: 'NOT_SCANNED' };
  if (!normalized) return null;
  return {
    dlpStatus: operator
      .trim()
      .toUpperCase()
      .replace(/[\s-]+/g, '_'),
  };
}

function buildRetentionFilter(
  operator: string,
): Prisma.DocumentWhereInput | null {
  const normalized = normalizeEnumText(operator);
  const now = new Date();
  const dueSoonLimit = new Date(now.getTime() + DUE_SOON_DAYS * DAY_MS);

  if (normalized === 'unset') {
    return {
      AND: [{ retentionClass: null }, { retentionUntil: null }],
    };
  }
  if (normalized === 'overdue') {
    return { retentionUntil: { lt: now } };
  }
  if (normalized === 'duesoon') {
    return { retentionUntil: { gte: now, lte: dueSoonLimit } };
  }
  if (normalized === 'active') {
    return { retentionUntil: { gt: dueSoonLimit } };
  }
  if (normalized === 'archived') {
    return { status: 'ARCHIVED' };
  }
  if (!operator.trim()) return null;

  return {
    OR: [
      { retentionClass: { contains: operator, mode: 'insensitive' } },
      { retentionReason: { contains: operator, mode: 'insensitive' } },
    ],
  };
}

function buildDateRangeFilter(
  range: DocumentDateRangeQuery,
): Prisma.DocumentWhereInput {
  const dateFilter: Prisma.DateTimeNullableFilter = {};
  if (range.from) dateFilter.gte = range.from;
  if (range.to) dateFilter.lte = range.to;
  return { [range.field]: dateFilter } as Prisma.DocumentWhereInput;
}

function parseDateRangeQuery(
  key: string,
  value: string,
): DocumentDateRangeQuery | null {
  const field: DocumentDateField =
    key === 'created'
      ? 'createdAt'
      : key === 'updated'
        ? 'updatedAt'
        : 'retentionUntil';
  const [rawFrom, rawTo] = value.includes('..')
    ? value.split('..', 2)
    : [value, value];
  const from = rawFrom ? parseDateBound(rawFrom, false) : undefined;
  const to = rawTo ? parseDateBound(rawTo, true) : undefined;

  if (!from && !to) return null;
  return {
    field,
    ...(from && { from }),
    ...(to && { to }),
  };
}

function parseDateBound(value: string, endOfDay: boolean): Date | undefined {
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  const normalized = /^\d{4}-\d{2}-\d{2}$/.test(trimmed)
    ? `${trimmed}T${endOfDay ? '23:59:59.999' : '00:00:00.000'}Z`
    : trimmed;
  const date = new Date(normalized);
  return Number.isFinite(date.getTime()) ? date : undefined;
}

function findEnumValue<T extends string>(
  values: readonly T[],
  query: string,
): T | null {
  const normalized = normalizeEnumText(query);
  return (
    values.find((value) => normalizeEnumText(value) === normalized) ?? null
  );
}

function normalizeText(value: string | null | undefined): string {
  return (value ?? '').trim().toLowerCase();
}

function normalizeEnumText(value: string | null | undefined): string {
  return normalizeText(value).replace(/[_\s-]+/g, '');
}
