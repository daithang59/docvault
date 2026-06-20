import {
  Body,
  Controller,
  ForbiddenException,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { createHash, timingSafeEqual } from 'crypto';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiTags,
  ApiSecurity,
} from '@nestjs/swagger';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { ProxyService } from './proxy.service';

function tokenMatches(providedToken: string, expectedToken: string): boolean {
  const providedDigest = createHash('sha256')
    .update(providedToken, 'utf8')
    .digest();
  const expectedDigest = createHash('sha256')
    .update(expectedToken, 'utf8')
    .digest();

  return timingSafeEqual(providedDigest, expectedDigest);
}

function assertAuditIngestToken(req: any): string {
  const expectedToken = process.env.AUDIT_INGEST_TOKEN;
  const providedToken = req.headers['x-docvault-service-token'];

  if (
    !expectedToken ||
    expectedToken.trim().length === 0 ||
    typeof providedToken !== 'string' ||
    !tokenMatches(providedToken, expectedToken)
  ) {
    throw new ForbiddenException('Invalid audit service token');
  }

  return providedToken;
}

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
    const serviceToken = assertAuditIngestToken(req);
    const response = await this.proxyService.forward(req, {
      method: 'POST',
      url: `${process.env.AUDIT_SERVICE_URL}/audit/events`,
      data: body,
      headers: {
        'x-docvault-service-token': serviceToken,
      },
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

  /** Seal an unrecoverably compromised chain and start a fresh active epoch. */
  @Post('chain/seal-and-start-epoch')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles('compliance_officer', 'admin')
  @ApiOperation({
    summary: 'Seal compromised audit epoch and start a new one',
    description:
      'Production-safe recovery path for tamper evidence: preserves the compromised epoch and starts a new active audit chain instead of recomputing old hashes.',
  })
  async sealCompromisedChainAndStartEpoch(@Req() req: any, @Body() body: any) {
    const response = await this.proxyService.forward(req, {
      method: 'POST',
      url: `${process.env.AUDIT_SERVICE_URL}/audit/chain/seal-and-start-epoch`,
      data: body,
    });
    return response.data;
  }

  /** Summarize security audit evidence for dashboard cards. */
  @Get('security-summary')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles('compliance_officer', 'admin')
  @ApiOperation({
    summary: 'Summarize security audit evidence',
    description:
      'Returns hash-chain status, security counters, repeated deny actors, deterministic document risk scoring, behavior anomaly signals, and prioritized security recommendations from audit metadata.',
  })
  async securitySummary(@Req() req: any) {
    const response = await this.proxyService.forward(req, {
      method: 'GET',
      url: `${process.env.AUDIT_SERVICE_URL}/audit/security-summary`,
    });
    return response.data;
  }

  /** Update recommendation investigation workflow state. */
  @Patch('security-recommendations/:id/workflow')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles('compliance_officer', 'admin')
  @ApiOperation({
    summary: 'Update security recommendation workflow state',
    description:
      'Appends an audit event for recommendation status and investigation note updates. File content, object keys, presigned URLs, and grant tokens must not be included.',
  })
  async updateSecurityRecommendationWorkflow(
    @Req() req: any,
    @Param('id') id: string,
    @Body() body: any,
  ) {
    const response = await this.proxyService.forward(req, {
      method: 'PATCH',
      url: `${process.env.AUDIT_SERVICE_URL}/audit/security-recommendations/${encodeURIComponent(id)}/workflow`,
      data: body,
    });
    return response.data;
  }

  /** Return append-only workflow history for one recommendation. */
  @Get('security-recommendations/:id/workflow-history')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles('compliance_officer', 'admin')
  @ApiOperation({
    summary: 'Get security recommendation workflow history',
    description:
      'Returns status/note timeline entries derived from audit events without file content, object keys, presigned URLs, or grant tokens.',
  })
  async getSecurityRecommendationWorkflowHistory(
    @Req() req: any,
    @Param('id') id: string,
  ) {
    const response = await this.proxyService.forward(req, {
      method: 'GET',
      url: `${process.env.AUDIT_SERVICE_URL}/audit/security-recommendations/${encodeURIComponent(id)}/workflow-history`,
    });
    return response.data;
  }
}
