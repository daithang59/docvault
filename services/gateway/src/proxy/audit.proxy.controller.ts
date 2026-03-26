import {
  Body,
  Controller,
  Get,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiTags,
  ApiSecurity,
} from '@nestjs/swagger';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { ProxyService } from './proxy.service';

@ApiTags('audit-proxy')
@ApiBearerAuth()
@ApiSecurity('cookie')
@Controller('audit')
export class AuditProxyController {
  constructor(private readonly proxyService: ProxyService) {}

  /** Used internally by other services to emit audit events. */
  @Post('events')
  @UseGuards(AuthGuard('jwt'))
  @ApiOperation({
    summary: 'Emit audit event',
    description:
      'Internal endpoint used by gateway and other services to emit audit log entries. ' +
      'Each event is linked to the previous via a SHA-256 hash chain for tamper-evidence.',
  })
  async create(@Req() req: any, @Body() body: any) {
    const response = await this.proxyService.forward(req, {
      method: 'POST',
      url: `${process.env.AUDIT_SERVICE_URL}/audit/events`,
      data: body,
    });
    return response.data;
  }

  /** Query audit log with filters. */
  @Get('query')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles('compliance_officer', 'admin')
  @ApiOperation({
    summary: 'Query audit logs',
    description:
      'Search audit events with optional filters: `actorId`, `action`, `resourceType`, ' +
      '`resourceId`, `from`, `to`, and pagination params.',
  })
  async query(@Req() req: any, @Query() query: any) {
    const response = await this.proxyService.forward(req, {
      method: 'GET',
      url: `${process.env.AUDIT_SERVICE_URL}/audit/query`,
      params: query,
    });
    return response.data;
  }

  /** Verify the integrity of the SHA-256 hash chain. */
  @Get('verify-chain')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles('compliance_officer', 'admin')
  @ApiOperation({
    summary: 'Verify audit hash chain',
    description:
      'Recomputes and verifies the SHA-256 hash chain for all audit events. ' +
      'Returns `valid: true` if no tampering is detected, or `valid: false` with details of the broken link.',
  })
  async verifyChain(@Req() req: any, @Query() query: any) {
    const response = await this.proxyService.forward(req, {
      method: 'GET',
      url: `${process.env.AUDIT_SERVICE_URL}/audit/verify-chain`,
      params: query,
    });
    return response.data;
  }
}
