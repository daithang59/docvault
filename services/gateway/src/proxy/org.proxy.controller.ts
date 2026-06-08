import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Req,
  UseGuards,
} from '@nestjs/common';
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

  @Get('members')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles('admin')
  @ApiOperation({
    summary: 'List members of the current user organization (admin only)',
  })
  async listMembers(@Req() req: any) {
    const response = await this.proxyService.forward(req, {
      method: 'GET',
      url: `${process.env.METADATA_SERVICE_URL}/orgs/members`,
    });
    return response.data;
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
}
