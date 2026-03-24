import { Body, Controller, Get, Post, Query, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { AuditService } from './audit.service';
import { CreateAuditEventDto } from './dto/create-audit-event.dto';
import { QueryAuditDto } from './dto/query-audit.dto';
import { IsOptional, IsInt, Min } from 'class-validator';
import { Type } from 'class-transformer';

@ApiTags('audit')
@ApiBearerAuth()
@Controller('audit')
export class AuditController {
  constructor(private readonly auditService: AuditService) {}

  @Post('events')
  @UseGuards(AuthGuard('jwt'))
  @ApiOperation({ summary: 'Append an audit event' })
  create(@Body() body: CreateAuditEventDto) {
    return this.auditService.create(body);
  }

  @Get('query')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles('compliance_officer')
  @ApiOperation({ summary: 'Query audit events (compliance officer only)' })
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
}
