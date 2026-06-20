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
import { AuthGuard } from '@nestjs/passport';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { OrgService } from './org.service';
import { buildRequestContext } from '../common/request-context';

@ApiTags('organizations')
@ApiBearerAuth()
@Controller('orgs')
export class OrgController {
  constructor(private readonly orgService: OrgService) {}

  @Get('me')
  @UseGuards(AuthGuard('jwt'))
  @ApiOperation({
    summary: 'Get the current user organization',
  })
  getMyOrg(@Req() req: any) {
    const ctx = buildRequestContext(req);
    return this.orgService.getMyOrg(ctx.actorId);
  }

  @Get('members')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles('editor', 'approver', 'compliance_officer', 'admin')
  @ApiOperation({
    summary:
      'List members of the current user organization (editor, approver, compliance officer, or admin). Used for ACL subject pickers.',
  })
  listMembers(@Req() req: any) {
    const ctx = buildRequestContext(req);
    return this.orgService.listMembers(ctx.actorId);
  }

  @Post('members')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles('admin')
  @ApiOperation({
    summary: 'Add a user to the current organization (admin only)',
  })
  addMember(@Body() body: { userId?: string; role?: string }, @Req() req: any) {
    const ctx = buildRequestContext(req);
    const userId = body?.userId?.trim();
    if (!userId) {
      throw new BadRequestException('userId is required');
    }
    const role = body?.role ?? 'MEMBER';
    if (role !== 'MEMBER' && role !== 'ADMIN') {
      throw new BadRequestException('role must be either MEMBER or ADMIN');
    }
    return this.orgService.addMember(ctx, userId, role);
  }

  @Patch('members/:userId')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles('admin')
  @ApiOperation({
    summary: 'Update a member role in the current organization (admin only)',
  })
  updateMemberRole(
    @Param('userId') userId: string,
    @Body() body: { role?: string },
    @Req() req: any,
  ) {
    const ctx = buildRequestContext(req);
    const role = body?.role;
    if (role !== 'MEMBER' && role !== 'ADMIN') {
      throw new BadRequestException('role must be either MEMBER or ADMIN');
    }
    return this.orgService.updateMemberRole(ctx, userId, role);
  }

  @Delete('members/:userId')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles('admin')
  @ApiOperation({
    summary: 'Remove a member from the current organization (admin only)',
  })
  removeMember(@Param('userId') userId: string, @Req() req: any) {
    const ctx = buildRequestContext(req);
    return this.orgService.removeMember(ctx, userId);
  }
}
