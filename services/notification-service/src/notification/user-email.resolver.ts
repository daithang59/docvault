import { Injectable, Logger } from '@nestjs/common';

interface KeycloakUser {
  id: string;
  email?: string;
  username?: string;
}

/**
 * Resolves a Keycloak user `sub` (UUID) to an email address via the Keycloak
 * Admin API, using client-credentials. Results are cached briefly to avoid
 * hammering Keycloak. Returns undefined when resolution is not possible
 * (misconfigured, user has no email, etc.) so callers can skip email cleanly.
 */
@Injectable()
export class UserEmailResolver {
  private readonly logger = new Logger(UserEmailResolver.name);
  private readonly cache = new Map<
    string,
    { email?: string; expiresAt: number }
  >();
  private static readonly TTL_MS = 5 * 60_000;

  private get baseUrl(): string | undefined {
    return process.env.KEYCLOAK_BASE_URL?.trim() || undefined;
  }
  private get realm(): string | undefined {
    return process.env.KEYCLOAK_REALM?.trim() || undefined;
  }
  private get clientId(): string | undefined {
    return process.env.KEYCLOAK_CLIENT_ID?.trim() || undefined;
  }
  private get clientSecret(): string | undefined {
    return process.env.KEYCLOAK_CLIENT_SECRET?.trim() || undefined;
  }

  /** True when admin-API resolution is configured. */
  isEnabled(): boolean {
    return Boolean(
      this.baseUrl && this.realm && this.clientId && this.clientSecret,
    );
  }

  async resolveEmail(sub: string): Promise<string | undefined> {
    if (!this.isEnabled()) return undefined;

    const cached = this.cache.get(sub);
    if (cached && cached.expiresAt > Date.now()) {
      return cached.email;
    }

    const email = await this.fetchEmail(sub);
    this.cache.set(sub, {
      email,
      expiresAt: Date.now() + UserEmailResolver.TTL_MS,
    });
    return email;
  }

  private async getAdminToken(): Promise<string | undefined> {
    try {
      const res = await fetch(
        `${this.baseUrl}/realms/${this.realm}/protocol/openid-connect/token`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: new URLSearchParams({
            grant_type: 'client_credentials',
            client_id: this.clientId!,
            client_secret: this.clientSecret!,
          }),
        },
      );
      if (!res.ok) return undefined;
      const data = (await res.json()) as { access_token?: string };
      return data.access_token;
    } catch (err) {
      this.logger.warn(`Keycloak admin token error: ${(err as Error).message}`);
      return undefined;
    }
  }

  private async fetchEmail(sub: string): Promise<string | undefined> {
    const token = await this.getAdminToken();
    if (!token) return undefined;

    try {
      const res = await fetch(
        `${this.baseUrl}/admin/realms/${this.realm}/users/${encodeURIComponent(sub)}`,
        { headers: { Authorization: `Bearer ${token}` } },
      );
      if (!res.ok) return undefined;
      const user = (await res.json()) as KeycloakUser;
      return user.email?.trim() || undefined;
    } catch (err) {
      this.logger.warn(`Keycloak user lookup error: ${(err as Error).message}`);
      return undefined;
    }
  }
}
