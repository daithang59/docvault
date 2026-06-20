import {
  BadRequestException,
  Controller,
  Get,
  HttpCode,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { buildRequestContext } from '../common/request-context';
import { RetentionService } from './retention.service';
import { OrgService } from '../org/org.service';

function parseAsOf(asOf?: string): Date | undefined {
  if (!asOf) return undefined;
  const parsed = new Date(asOf);
  if (Number.isNaN(parsed.getTime())) {
    throw new BadRequestException('asOf must be a valid ISO date');
  }
  return parsed;
}

@ApiTags('retention')
@ApiBearerAuth()
@Controller('retention')
export class RetentionController {
  constructor(
    private readonly retentionService: RetentionService,
    private readonly orgService: OrgService,
  ) {}

  @Get('documents')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles('compliance_officer', 'admin')
  @ApiOperation({ summary: 'List retention evidence for published records' })
  async list(@Req() req: any, @Query('asOf') asOf?: string) {
    const context = buildRequestContext(req);
    const organizationId = await this.orgService.requireOrgId(context.actorId);
    return this.retentionService.listRetentionEvidence(
      parseAsOf(asOf),
      organizationId,
    );
  }

  @Post('run')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles('admin')
  @HttpCode(200)
  @ApiOperation({ summary: 'Run retention auto-archive job now' })
  run(@Req() req: any, @Query('asOf') asOf?: string) {
    const context = buildRequestContext(req);
    return this.retentionService.runRetention({
      now: parseAsOf(asOf),
      requestedBy: context.actorId,
    });
  }
}
