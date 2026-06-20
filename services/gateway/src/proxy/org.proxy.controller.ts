import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import axios from 'axios';
import { AuthGuard } from '@nestjs/passport';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiSecurity,
  ApiTags,
} from '@nestjs/swagger';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { ProxyService } from './proxy.service';

@ApiTags('orgs-proxy')
@ApiBearerAuth()
@ApiSecurity('cookie')
@Controller('orgs')
export class OrgProxyController {
  constructor(private readonly proxyService: ProxyService) {}

  @Get('me')
  @UseGuards(AuthGuard('jwt'))
  @ApiOperation({
    summary:
      'Get the current user organization (auto-provisions on first call)',
  })
  async getMyOrg(@Req() req: any) {
    const response = await this.proxyService.forward(req, {
      method: 'GET',
      url: `${process.env.METADATA_SERVICE_URL}/orgs/me`,
    });
    return response.data;
  }

  @Post('members')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles('admin')
  @ApiOperation({
    summary:
      'Add a member to the current organization by username, email, or user id (admin only)',
  })
  async addMember(@Body() body: any, @Req() req: any) {
    const identifier = (body?.userId ?? body?.username ?? body?.email ?? '')
      .toString()
      .trim();
    if (!identifier) {
      throw new BadRequestException(
        'Provide a username, email, or user id to add a member',
      );
    }
    const role = body?.role === 'ADMIN' ? 'ADMIN' : 'MEMBER';
    const targetUserId = await this.resolveKeycloakSub(req, identifier);

    const response = await this.proxyService.forward(req, {
      method: 'POST',
      url: `${process.env.METADATA_SERVICE_URL}/orgs/members`,
      data: { userId: targetUserId, role },
    });
    return response.data;
  }

  @Get('members')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles('editor', 'approver', 'compliance_officer', 'admin')
  @ApiOperation({
    summary:
      'List members of the current user organization (editor, approver, compliance officer, or admin). Used for ACL subject pickers.',
  })
  async listMembers(@Req() req: any) {
    const response = await this.proxyService.forward(req, {
      method: 'GET',
      url: `${process.env.METADATA_SERVICE_URL}/orgs/members`,
    });
    return response.data;
  }

  @Get('groups')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles('editor', 'approver', 'compliance_officer', 'admin')
  @ApiOperation({
    summary:
      'List Keycloak realm groups for ACL subject pickers. Returns [] when admin credentials are not configured.',
  })
  async listGroups(): Promise<
    Array<{ id: string; name: string; path: string }>
  > {
    const baseUrl = process.env.KEYCLOAK_BASE_URL;
    const realm = process.env.KEYCLOAK_REALM;
    if (!baseUrl || !realm || !process.env.KEYCLOAK_CLIENT_SECRET) {
      return [];
    }

    let adminToken: string;
    try {
      adminToken = await this.getAdminToken();
    } catch {
      return [];
    }

    try {
      const res = await axios.get<
        Array<{ id: string; name: string; path: string }>
      >(`${baseUrl}/admin/realms/${realm}/groups?briefRepresentation=true`, {
        headers: { Authorization: `Bearer ${adminToken}` },
        timeout: 5000,
      });
      const flatten = (
        groups: Array<{
          id: string;
          name: string;
          path: string;
          subGroups?: any[];
        }>,
      ): Array<{ id: string; name: string; path: string }> =>
        groups.flatMap((g) => [
          { id: g.id, name: g.name, path: g.path },
          ...(Array.isArray(g.subGroups) ? flatten(g.subGroups) : []),
        ]);
      return flatten(res.data ?? []);
    } catch {
      return [];
    }
  }

  @Patch('members/:userId')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles('admin')
  @ApiOperation({ summary: 'Update a member role (admin only)' })
  async updateMemberRole(
    @Param('userId') userId: string,
    @Body() body: any,
    @Req() req: any,
  ) {
    const response = await this.proxyService.forward(req, {
      method: 'PATCH',
      url: `${process.env.METADATA_SERVICE_URL}/orgs/members/${userId}`,
      data: body,
    });
    return response.data;
  }

  @Delete('members/:userId')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles('admin')
  @ApiOperation({
    summary: 'Remove a member from the organization (admin only)',
  })
  async removeMember(@Param('userId') userId: string, @Req() req: any) {
    const response = await this.proxyService.forward(req, {
      method: 'DELETE',
      url: `${process.env.METADATA_SERVICE_URL}/orgs/members/${userId}`,
    });
    return response.data;
  }

  /**
   * Resolve an identifier (Keycloak `sub` UUID, username, or email) to the
   * stable Keycloak `sub`. The `sub` is the canonical key used by
   * OrganizationMembership downstream, so we must resolve before forwarding.
   */
  private async resolveKeycloakSub(
    req: any,
    identifier: string,
  ): Promise<string> {
    const baseUrl = process.env.KEYCLOAK_BASE_URL;
    const realm = process.env.KEYCLOAK_REALM;

    const looksLikeUuid =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
        identifier,
      );

    if (!baseUrl || !realm || !process.env.KEYCLOAK_CLIENT_SECRET) {
      if (looksLikeUuid) {
        return identifier;
      }
      throw new BadRequestException(
        'Cannot resolve user — Keycloak admin credentials are not configured. Provide the user id (sub).',
      );
    }

    const adminToken = await this.getAdminToken();

    if (looksLikeUuid) {
      try {
        const res = await axios.get<{ id: string }>(
          `${baseUrl}/admin/realms/${realm}/users/${identifier}`,
          {
            headers: { Authorization: `Bearer ${adminToken}` },
            timeout: 5000,
          },
        );
        return res.data.id;
      } catch {
        throw new BadRequestException('No Keycloak user found for that id');
      }
    }

    const isEmail = identifier.includes('@');
    const query = isEmail
      ? `email=${encodeURIComponent(identifier)}&exact=true`
      : `username=${encodeURIComponent(identifier)}&exact=true`;

    let users: Array<{ id: string; username?: string; email?: string }> = [];
    try {
      const res = await axios.get<typeof users>(
        `${baseUrl}/admin/realms/${realm}/users?${query}`,
        {
          headers: { Authorization: `Bearer ${adminToken}` },
          timeout: 5000,
        },
      );
      users = res.data;
    } catch {
      throw new BadRequestException('Failed to look up user in Keycloak');
    }

    const match = isEmail
      ? users.find((u) => u.email?.toLowerCase() === identifier.toLowerCase())
      : users.find((u) => u.username === identifier);

    if (!match) {
      throw new BadRequestException(
        `No Keycloak user found for "${identifier}"`,
      );
    }
    return match.id;
  }

  private async getAdminToken(): Promise<string> {
    const res = await axios.post<{ access_token: string }>(
      `${process.env.KEYCLOAK_BASE_URL}/realms/${process.env.KEYCLOAK_REALM}/protocol/openid-connect/token`,
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
