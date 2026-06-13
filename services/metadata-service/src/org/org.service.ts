import {
  BadRequestException,
  ForbiddenException,
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
 * Membership is granted explicitly by an admin via addMember(); users are NOT
 * auto-provisioned. A user with no membership is denied access until assigned.
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
   * Return the orgId for a user. Throws if the user has not been assigned to
   * an organization (membership is granted explicitly by an admin).
   */
  async requireOrgId(actorId: string): Promise<string> {
    const cached = this.cache.get(actorId);
    if (cached && cached.expiresAt > Date.now()) {
      return cached.orgId;
    }

    const orgId = await this.resolveOrgId(actorId);
    this.cache.set(actorId, {
      orgId,
      expiresAt: Date.now() + OrgService.CACHE_TTL_MS,
    });
    return orgId;
  }

  /** Return the current user's organization with their membership role. */
  async getMyOrg(actorId: string) {
    const orgId = await this.requireOrgId(actorId);
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
   * Add a user (resolved to their stable Keycloak `sub`) to the caller's
   * organization. If the target is already a member, their role is updated.
   *
   * Handles the legacy "self-service" leftover: a user who logged in before
   * this flow existed may own an empty solo organization. That orphan org is
   * cleaned up so the user is cleanly reassigned to the caller's org.
   */
  async addMember(
    context: RequestContext,
    targetUserId: string,
    role: 'MEMBER' | 'ADMIN' = 'MEMBER',
  ) {
    const adminActorId = context.actorId;
    const organizationId = await this.requireOrgId(adminActorId);

    const normalizedTarget = targetUserId.trim();
    if (!normalizedTarget) {
      throw new BadRequestException('targetUserId is required');
    }

    const existingMemberships =
      await this.prisma.organizationMembership.findMany({
        where: { userId: normalizedTarget },
        include: { organization: true },
      });

    const alreadyHere = existingMemberships.find(
      (m) => m.organizationId === organizationId,
    );
    if (alreadyHere) {
      if (alreadyHere.role === role) {
        return {
          userId: alreadyHere.userId,
          role: alreadyHere.role,
          joinedAt: alreadyHere.createdAt,
        };
      }
      const updated = await this.prisma.organizationMembership.update({
        where: {
          organizationId_userId: {
            organizationId,
            userId: normalizedTarget,
          },
        },
        data: { role },
      });
      this.invalidate(normalizedTarget);
      await this.auditClient.emitEvent(context, {
        action: 'ORG_MEMBER_ROLE_CHANGED',
        resourceType: 'ORGANIZATION_MEMBER',
        resourceId: normalizedTarget,
        result: 'SUCCESS',
        metadata: {
          organizationId,
          targetUserId: normalizedTarget,
          fromRole: alreadyHere.role,
          toRole: updated.role,
        },
      });
      return {
        userId: updated.userId,
        role: updated.role,
        joinedAt: updated.createdAt,
      };
    }

    const otherMemberships = existingMemberships.filter(
      (m) => m.organizationId !== organizationId,
    );

    for (const membership of otherMemberships) {
      const memberCount = await this.prisma.organizationMembership.count({
        where: { organizationId: membership.organizationId },
      });
      const isOrphanSoloOrg =
        memberCount === 1 &&
        membership.organization?.ownerId === normalizedTarget;
      if (!isOrphanSoloOrg) {
        throw new BadRequestException(
          'User already belongs to another organization. Remove them there first.',
        );
      }
      // Drop the orphan solo org (cascade removes its membership).
      await this.prisma.organization.delete({
        where: { id: membership.organizationId },
      });
      this.logger.log(
        `Removed orphan org ${membership.organizationId} while reassigning user ${normalizedTarget}`,
      );
    }

    const created = await this.prisma.organizationMembership.create({
      data: { organizationId, userId: normalizedTarget, role },
    });
    this.invalidate(normalizedTarget);

    await this.auditClient.emitEvent(context, {
      action: 'ORG_MEMBER_ADDED',
      resourceType: 'ORGANIZATION_MEMBER',
      resourceId: normalizedTarget,
      result: 'SUCCESS',
      metadata: {
        organizationId,
        targetUserId: normalizedTarget,
        role: created.role,
      },
    });

    return {
      userId: created.userId,
      role: created.role,
      joinedAt: created.createdAt,
    };
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

  private async resolveOrgId(actorId: string): Promise<string> {
    const existing = await this.prisma.organizationMembership.findFirst({
      where: { userId: actorId },
      orderBy: { createdAt: 'asc' },
    });
    if (!existing) {
      throw new ForbiddenException(
        'You are not assigned to any organization. Ask an administrator to add you.',
      );
    }
    return existing.organizationId;
  }
}
