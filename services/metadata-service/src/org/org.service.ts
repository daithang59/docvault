import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuditClient } from '../audit/audit.client';
import { RequestContext } from '../common/request-context';

interface CacheEntry {
  orgId: string;
  expiresAt: number;
}

/**
 * Resolves the organization a user belongs to (single org per user model).
 *
 * Source of truth is the app database (OrganizationMembership), NOT the JWT.
 * On first access for an unknown user, an organization is lazily provisioned
 * and the user becomes its ADMIN — this is the "self-service signup" flow.
 *
 * Results are cached briefly to avoid a DB hit on every request.
 */
@Injectable()
export class OrgService {
  private readonly logger = new Logger(OrgService.name);
  private readonly cache = new Map<string, CacheEntry>();
  private static readonly CACHE_TTL_MS = 60_000;

  constructor(
    private readonly prisma: PrismaService,
    private readonly auditClient: AuditClient,
  ) {}

  /**
   * Return the orgId for a user, provisioning a new org if the user has none.
   * `displayName` is used to name a freshly-created org.
   */
  async requireOrgId(actorId: string, displayName?: string): Promise<string> {
    const cached = this.cache.get(actorId);
    if (cached && cached.expiresAt > Date.now()) {
      return cached.orgId;
    }

    const orgId = await this.resolveOrProvision(actorId, displayName);
    this.cache.set(actorId, {
      orgId,
      expiresAt: Date.now() + OrgService.CACHE_TTL_MS,
    });
    return orgId;
  }

  /** Return the current user's organization with their membership role. */
  async getMyOrg(actorId: string, displayName?: string) {
    const orgId = await this.requireOrgId(actorId, displayName);
    const [org, membership] = await Promise.all([
      this.prisma.organization.findUnique({ where: { id: orgId } }),
      this.prisma.organizationMembership.findUnique({
        where: {
          organizationId_userId: { organizationId: orgId, userId: actorId },
        },
      }),
    ]);
    return {
      id: org?.id ?? orgId,
      name: org?.name ?? 'Organization',
      slug: org?.slug ?? orgId,
      role: membership?.role ?? 'MEMBER',
    };
  }

  /** List members of the caller's organization. */
  async listMembers(actorId: string) {
    const orgId = await this.requireOrgId(actorId);
    const members = await this.prisma.organizationMembership.findMany({
      where: { organizationId: orgId },
      orderBy: { createdAt: 'asc' },
    });
    return members.map((m) => ({
      userId: m.userId,
      role: m.role,
      joinedAt: m.createdAt,
    }));
  }

  /**
   * Change a member's role within the caller's organization.
   * Refuses to demote the last remaining ADMIN (an org must keep one admin).
   */
  async updateMemberRole(
    context: RequestContext,
    targetUserId: string,
    role: 'MEMBER' | 'ADMIN',
  ) {
    const adminActorId = context.actorId;
    const organizationId = await this.requireOrgId(adminActorId);

    const membership = await this.prisma.organizationMembership.findUnique({
      where: {
        organizationId_userId: { organizationId, userId: targetUserId },
      },
    });
    if (!membership) {
      throw new NotFoundException('Member not found in this organization');
    }

    if (membership.role === 'ADMIN' && role === 'MEMBER') {
      await this.assertNotLastAdmin(organizationId);
    }

    const updated = await this.prisma.organizationMembership.update({
      where: {
        organizationId_userId: { organizationId, userId: targetUserId },
      },
      data: { role },
    });

    this.invalidate(targetUserId);

    await this.auditClient.emitEvent(context, {
      action: 'ORG_MEMBER_ROLE_CHANGED',
      resourceType: 'ORGANIZATION_MEMBER',
      resourceId: targetUserId,
      result: 'SUCCESS',
      metadata: {
        organizationId,
        targetUserId,
        fromRole: membership.role,
        toRole: updated.role,
      },
    });

    return {
      userId: updated.userId,
      role: updated.role,
      joinedAt: updated.createdAt,
    };
  }

  /**
   * Remove a member from the caller's organization.
   * Refuses to remove the last remaining ADMIN.
   */
  async removeMember(context: RequestContext, targetUserId: string) {
    const adminActorId = context.actorId;
    const organizationId = await this.requireOrgId(adminActorId);

    const membership = await this.prisma.organizationMembership.findUnique({
      where: {
        organizationId_userId: { organizationId, userId: targetUserId },
      },
    });
    if (!membership) {
      throw new NotFoundException('Member not found in this organization');
    }

    if (membership.role === 'ADMIN') {
      await this.assertNotLastAdmin(organizationId);
    }

    await this.prisma.organizationMembership.delete({
      where: {
        organizationId_userId: { organizationId, userId: targetUserId },
      },
    });

    this.invalidate(targetUserId);

    await this.auditClient.emitEvent(context, {
      action: 'ORG_MEMBER_REMOVED',
      resourceType: 'ORGANIZATION_MEMBER',
      resourceId: targetUserId,
      result: 'SUCCESS',
      metadata: {
        organizationId,
        targetUserId,
        removedRole: membership.role,
      },
    });

    return { userId: targetUserId, removed: true };
  }

  /** Drop a user's cached org (e.g. after membership changes). */
  invalidate(actorId: string): void {
    this.cache.delete(actorId);
  }

  private async assertNotLastAdmin(organizationId: string): Promise<void> {
    const adminCount = await this.prisma.organizationMembership.count({
      where: { organizationId, role: 'ADMIN' },
    });
    if (adminCount <= 1) {
      throw new BadRequestException(
        'Cannot remove or demote the last admin of an organization',
      );
    }
  }

  private async resolveOrProvision(
    actorId: string,
    displayName?: string,
  ): Promise<string> {
    const existing = await this.prisma.organizationMembership.findFirst({
      where: { userId: actorId },
      orderBy: { createdAt: 'asc' },
    });
    if (existing) {
      return existing.organizationId;
    }

    // Lazy provision: create a new organization owned by this user.
    const baseName = displayName?.trim() || actorId;
    const slug = await this.uniqueSlug(baseName);
    const org = await this.prisma.organization.create({
      data: {
        name: `${baseName}'s Organization`,
        slug,
        ownerId: actorId,
        memberships: {
          create: { userId: actorId, role: 'ADMIN' },
        },
      },
    });
    this.logger.log(
      `Provisioned organization ${org.id} (${slug}) for user ${actorId}`,
    );
    return org.id;
  }

  private async uniqueSlug(base: string): Promise<string> {
    const root =
      base
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '')
        .slice(0, 40) || 'org';
    let slug = root;
    let suffix = 1;
    // Collisions are rare; bounded retry keeps it simple.
    while (await this.prisma.organization.findUnique({ where: { slug } })) {
      slug = `${root}-${suffix++}`;
    }
    return slug;
  }
}
