import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { ServiceTokenGuard } from '../auth/service-token.guard';
import { AuditService } from './audit.service';
import { CreateAuditEventDto } from './dto/create-audit-event.dto';
import { QueryAuditDto } from './dto/query-audit.dto';
import { SealAuditChainDto } from './dto/seal-audit-chain.dto';
import { SecurityRecommendationWorkflowDto } from './dto/security-recommendation-workflow.dto';

@ApiTags('audit')
@ApiBearerAuth()
@Controller('audit')
export class AuditController {
  constructor(private readonly auditService: AuditService) {}

  /**
   * Append a new audit event to the immutable log.
   * Called by trusted services with the internal audit ingest token.
   */
  @Post('events')
  @UseGuards(ServiceTokenGuard)
  @ApiOperation({ summary: 'Append an audit event' })
  create(@Body() body: CreateAuditEventDto) {
    return this.auditService.create(body);
  }

  @Get('query')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles('compliance_officer', 'admin')
  @ApiOperation({ summary: 'Query audit events (compliance officer or admin)' })
  query(@Query() query: QueryAuditDto) {
    return this.auditService.query(query);
  }

  @Get('verify-chain')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles('compliance_officer', 'admin')
  @ApiOperation({ summary: 'Verify integrity of the audit hash chain' })
  verifyChain(@Query('limit') limitStr?: string) {
    const limit = limitStr ? Math.min(Number(limitStr), 5000) : 1000;
    return this.auditService.verifyChain(limit);
  }

  @Post('chain/seal-and-start-epoch')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles('compliance_officer', 'admin')
  @ApiOperation({
    summary: 'Seal a compromised audit epoch and start a new active epoch',
  })
  sealCompromisedChainAndStartEpoch(
    @Body() body: SealAuditChainDto,
    @Req() req: any,
  ) {
    return this.auditService.sealCompromisedChainAndStartEpoch(body, {
      actorId: req.user?.username ?? req.user?.sub,
      roles: Array.isArray(req.user?.roles) ? req.user.roles : [],
      ip: req.ip,
      traceId: req.headers?.['x-trace-id'],
    });
  }

  @Get('security-summary')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles('compliance_officer', 'admin')
  @ApiOperation({ summary: 'Summarize security audit evidence' })
  securitySummary(@Req() req: any) {
    return this.auditService.securitySummary({
      actorId: req.user?.username ?? req.user?.sub,
      roles: Array.isArray(req.user?.roles) ? req.user.roles : [],
      ip: req.ip,
      traceId: req.headers?.['x-trace-id'],
    });
  }

  @Patch('security-recommendations/:id/workflow')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles('compliance_officer', 'admin')
  @ApiOperation({ summary: 'Update security recommendation workflow state' })
  updateSecurityRecommendationWorkflow(
    @Param('id') id: string,
    @Body() body: SecurityRecommendationWorkflowDto,
    @Req() req: any,
  ) {
    return this.auditService.updateSecurityRecommendationWorkflow(id, body, {
      actorId: req.user?.username ?? req.user?.sub,
      roles: Array.isArray(req.user?.roles) ? req.user.roles : [],
      ip: req.ip,
      traceId: req.headers?.['x-trace-id'],
    });
  }

  @Get('security-recommendations/:id/workflow-history')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles('compliance_officer', 'admin')
  @ApiOperation({ summary: 'Get security recommendation workflow history' })
  getSecurityRecommendationWorkflowHistory(@Param('id') id: string) {
    return this.auditService.getSecurityRecommendationWorkflowHistory(id);
  }
}
