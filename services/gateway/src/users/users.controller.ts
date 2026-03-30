import { Controller, Get, Post, Body, Req, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';
import { Request } from 'express';
import axios from 'axios';

interface KeycloakUserInfo {
  sub: string;
  preferred_username?: string;
  username?: string;
  name?: string;
  given_name?: string;
  family_name?: string;
  email?: string;
  email_verified?: boolean;
}

@ApiTags('users')
@Controller('users')
export class UsersController {
  private readonly keycloakBaseUrl: string;
  private readonly realm: string;

  constructor() {
    this.keycloakBaseUrl = process.env.KEYCLOAK_BASE_URL!;
    this.realm = process.env.KEYCLOAK_REALM!;
  }

  /**
   * Fetch the current user's full profile from the Keycloak UserInfo endpoint.
   * This returns fresh data directly from Keycloak (not just JWT claims).
   */
  @Get('profile')
  @UseGuards(AuthGuard('jwt'))
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Get current user profile',
    description:
      'Returns the authenticated user profile from Keycloak UserInfo endpoint. ' +
      'Includes display name, first/last name, email — fresher than JWT claims alone.',
  })
  async getProfile(@Req() req: Request & { user?: Record<string, unknown> }) {
    const accessToken = req.headers['authorization']?.replace('Bearer ', '');

    if (!accessToken) {
      // Fall back to JWT claims already parsed by JwtStrategy
      const user = req.user;
      if (!user) throw new Error('No user info available');

      const displayName =
        (user['displayName'] as string) ??
        ([user['firstName'] as string, user['lastName'] as string]
          .filter(Boolean)
          .join(' ') ||
          undefined);

      return {
        sub: user['sub'],
        username: user['username'],
        displayName,
        firstName: user['firstName'],
        lastName: user['lastName'],
        email: user['email'],
        roles: user['roles'],
      };
    }

    try {
      const userInfoRes = await axios.get<KeycloakUserInfo>(
        `${this.keycloakBaseUrl}/realms/${this.realm}/protocol/openid-connect/userinfo`,
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
          timeout: 10_000,
        },
      );

      const u = userInfoRes.data;
      return {
        sub: u.sub,
        username: u.preferred_username ?? u.username,
        displayName:
          u.name ??
          ([u.given_name, u.family_name].filter(Boolean).join(' ') ||
            undefined),
        firstName: u.given_name,
        lastName: u.family_name,
        email: u.email,
        // Roles come from the JWT (already in req.user) — not included in Keycloak UserInfo
        roles: req.user?.['roles'],
      };
    } catch {
      // Keycloak UserInfo failed — fall back to JWT claims
      const user = req.user;
      if (!user) throw new Error('No user info available');

      const displayName =
        (user['displayName'] as string) ??
        ([user['firstName'] as string, user['lastName'] as string]
          .filter(Boolean)
          .join(' ') ||
          undefined);

      return {
        sub: user['sub'],
        username: user['username'],
        displayName,
        firstName: user['firstName'],
        lastName: user['lastName'],
        email: user['email'],
        roles: user['roles'],
      };
    }
  }

  /**
   * Batch-fetch user display names by user IDs.
   * Strategy:
   * 1. If KEYCLOAK_CLIENT_SECRET is set → uses Keycloak Admin API (full names).
   * 2. Falls back to Keycloak UserInfo endpoint (per-user token fetch) for the
   *    displayName fields that are present in JWTs (firstName/lastName if set).
   * 3. Falls back to formatting the username (e.g. "editor1" → "Editor 1").
   *
   * Accepts either Keycloak `sub` (UUID) or Keycloak `username` as IDs.
   */
  @Post('batch')
  @UseGuards(AuthGuard('jwt'))
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Batch-fetch user profiles by IDs',
    description:
      'Returns a map of { [userId]: { displayName, username } } for the given user IDs. ' +
      'Supports both Keycloak user UUIDs (sub) and usernames.',
  })
  async getBatch(
    @Body() body: { ids: string[] },
    @Req() req: Request & { user?: Record<string, unknown> },
  ) {
    const accessToken = req.headers['authorization']?.replace('Bearer ', '');
    const { ids } = body;

    if (!ids?.length) return {};
    const result: Record<string, { displayName: string; username: string }> =
      {};

    // If admin credentials are available, use Keycloak Admin API for full names
    if (process.env.KEYCLOAK_CLIENT_SECRET) {
      try {
        const adminToken = await this.getAdminToken();
        await Promise.allSettled(
          ids.map(async (userId) => {
            try {
              // Check if userId is a UUID (contains hyphens) — use direct fetch
              // Otherwise treat as username and search first
              let kcUser: {
                id: string;
                username: string;
                firstName?: string;
                lastName?: string;
                displayName?: string;
                attributes?: { displayName?: string[] };
              };

              if (userId.includes('-')) {
                // Direct fetch by UUID
                const res = await axios.get(
                  `${this.keycloakBaseUrl}/admin/realms/${this.realm}/users/${userId}`,
                  {
                    headers: { Authorization: `Bearer ${adminToken}` },
                    timeout: 5000,
                  },
                );
                kcUser = res.data;
              } else {
                // Search by username
                const searchRes = await axios.get<
                  {
                    id: string;
                    username: string;
                    firstName?: string;
                    lastName?: string;
                    displayName?: string;
                    attributes?: { displayName?: string[] };
                  }[]
                >(
                  `${this.keycloakBaseUrl}/admin/realms/${this.realm}/users?username=${encodeURIComponent(userId)}`,
                  {
                    headers: { Authorization: `Bearer ${adminToken}` },
                    timeout: 5000,
                  },
                );
                const found = searchRes.data.find((u) => u.username === userId);
                if (!found) {
                  result[userId] = {
                    displayName: formatUsername(userId),
                    username: userId,
                  };
                  return;
                }
                kcUser = found;
              }

              result[userId] = {
                displayName:
                  kcUser.attributes?.displayName?.[0] ??
                  kcUser.displayName ??
                  ([kcUser.firstName, kcUser.lastName]
                    .filter(Boolean)
                    .join(' ') ||
                    kcUser.username),
                username: kcUser.username,
              };
            } catch {
              result[userId] = {
                displayName: formatUsername(userId),
                username: userId,
              };
            }
          }),
        );
        return result;
      } catch {
        // Admin token failed → fall through to next strategy
      }
    }

    // Strategy 2: Use Keycloak UserInfo endpoint for each user
    // Keycloak allows fetching UserInfo with any valid realm token
    await Promise.allSettled(
      ids.map(async (userId) => {
        try {
          const res = await axios.get<{
            sub: string;
            preferred_username?: string;
            name?: string;
            given_name?: string;
            family_name?: string;
          }>(
            `${this.keycloakBaseUrl}/realms/${this.realm}/protocol/openid-connect/userinfo`,
            {
              headers: { Authorization: `Bearer ${accessToken}` },
              timeout: 5000,
            },
          );
          const u = res.data;
          const displayName =
            u.name ??
            [u.given_name, u.family_name].filter(Boolean).join(' ') ??
            formatUsername(userId);
          result[userId] = {
            displayName,
            username: u.preferred_username ?? userId,
          };
        } catch {
          result[userId] = {
            displayName: formatUsername(userId),
            username: userId,
          };
        }
      }),
    );

    return result;
  }

  private async getAdminToken(): Promise<string> {
    const res = await axios.post<{ access_token: string }>(
      `${this.keycloakBaseUrl}/realms/${this.realm}/protocol/openid-connect/token`,
      new URLSearchParams({
        grant_type: 'client_credentials',
        client_id: process.env.KEYCLOAK_CLIENT_ID ?? 'admin-cli',
        client_secret: process.env.KEYCLOAK_CLIENT_SECRET ?? '',
      }),
      { timeout: 10_000 },
    );
    return res.data.access_token;
  }
}

function formatUsername(username: string): string {
  // "editor1" → "Editor 1", "admin1" → "Admin 1", "co1" → "CO 1"
  return username
    .replace(/(\d+)$/, ' $1')
    .replace(/^[a-z]+/, (m) => m.charAt(0).toUpperCase() + m.slice(1));
}
