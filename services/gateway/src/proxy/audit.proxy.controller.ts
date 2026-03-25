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
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { ProxyService } from './proxy.service';

@ApiTags('audit-proxy')
@ApiBearerAuth()
@Controller('audit')
export class AuditProxyController {
  constructor(private readonly proxyService: ProxyService) {}

  @Post('events')
  @UseGuards(AuthGuard('jwt'))
  @ApiOperation({ summary: 'Proxy -> audit-service POST /audit/events' })
  async create(@Req() req: any, @Body() body: any) {
    const response = await this.proxyService.forward(req, {
      method: 'POST',
      url: `${process.env.AUDIT_SERVICE_URL}/audit/events`,
      data: body,
    });
    return response.data;
  }

  @Get('query')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles('compliance_officer', 'admin')
  @ApiOperation({ summary: 'Proxy -> audit-service GET /audit/query' })
  async query(@Req() req: any, @Query() query: any) {
    const response = await this.proxyService.forward(req, {
      method: 'GET',
      url: `${process.env.AUDIT_SERVICE_URL}/audit/query`,
      params: query,
    });
    return response.data;
  }

  @Get('verify-chain')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles('compliance_officer', 'admin')
  @ApiOperation({ summary: 'Proxy -> audit-service GET /audit/verify-chain' })
  async verifyChain(@Req() req: any, @Query() query: any) {
    const response = await this.proxyService.forward(req, {
      method: 'GET',
      url: `${process.env.AUDIT_SERVICE_URL}/audit/verify-chain`,
      params: query,
    });
    return response.data;
  }
}
