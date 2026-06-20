import { Injectable, Logger } from '@nestjs/common';

/**
 * Resolves the set of users who should receive approval/admin-targeted
 * notifications (everyone with the 'approver' or 'admin' realm role).
 *
 * Extracted from DocumentsService so services that DocumentsModule depends on
 * (e.g. VersionsService) can resolve recipients without a circular import.
 *
 * Uses admin credentials (admin-cli client with password grant) to query the
 * Keycloak Admin REST API. Falls back to an empty list if credentials are
 * absent or the query fails — recipient resolution must never block writes.
 *
 * Required env vars (already set in docker-compose infra):
 *   KEYCLOAK_BASE_URL       — e.g. http://localhost:8080
 *   KEYCLOAK_REALM          — e.g. docvault
 *   KEYCLOAK_ADMIN          — admin username (e.g. admin)
 *   KEYCLOAK_ADMIN_PASSWORD — admin password
 *
 * Cache: 60 seconds. If credentials are absent → { userIds: [] } (silent no-op).
 */
@Injectable()
export class ApproverDirectoryService {
  private readonly logger = new Logger(ApproverDirectoryService.name);

  private approverCache: { ids: string[]; expiresAt: number } | null = null;
  private static readonly APPROVER_CACHE_TTL_MS = 60_000;

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
        expiresAt: now + ApproverDirectoryService.APPROVER_CACHE_TTL_MS,
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
        expiresAt: now + ApproverDirectoryService.APPROVER_CACHE_TTL_MS,
      };
      return { userIds: ids };
    } catch (err) {
      // Don't cache on failure — next call will retry automatically.
      // Only cache when credentials are permanently absent (not transient errors).
      this.logger.warn(
        `getApprovers() failed: ${(err as Error).message} — returning empty list (will retry on next call)`,
      );
      return { userIds: [] };
    }
  }
}
