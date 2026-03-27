import { Controller, Get, Req, UseGuards } from '@nestjs/common';
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
        ([user['firstName'] as string, user['lastName'] as string].filter(Boolean).join(' ') ||
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
          u.name ?? ([u.given_name, u.family_name].filter(Boolean).join(' ') || undefined),
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
        ([user['firstName'] as string, user['lastName'] as string].filter(Boolean).join(' ') ||
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
}
