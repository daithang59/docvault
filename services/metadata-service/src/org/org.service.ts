import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

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

  constructor(private readonly prisma: PrismaService) {}

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
        where: { organizationId_userId: { organizationId: orgId, userId: actorId } },
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

  /** Drop a user's cached org (e.g. after membership changes). */
  invalidate(actorId: string): void {
    this.cache.delete(actorId);
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
