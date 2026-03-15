import { Body, Controller, Param, Post, Req, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { ProxyService } from './proxy.service';

@ApiTags('workflow-proxy')
@ApiBearerAuth()
@Controller('workflow')
export class WorkflowProxyController {
  constructor(private readonly proxyService: ProxyService) {}

  @Post(':docId/submit')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles('editor', 'admin')
  @ApiOperation({ summary: 'Proxy -> workflow-service POST /workflow/:docId/submit' })
  async submit(@Param('docId') docId: string, @Req() req: any) {
    const response = await this.proxyService.forward(req, {
      method: 'POST',
      url: `${process.env.WORKFLOW_SERVICE_URL}/workflow/${docId}/submit`,
    });
    return response.data;
  }

  @Post(':docId/approve')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles('approver', 'admin')
  @ApiOperation({ summary: 'Proxy -> workflow-service POST /workflow/:docId/approve' })
  async approve(@Param('docId') docId: string, @Req() req: any) {
    const response = await this.proxyService.forward(req, {
      method: 'POST',
      url: `${process.env.WORKFLOW_SERVICE_URL}/workflow/${docId}/approve`,
    });
    return response.data;
  }

  @Post(':docId/reject')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles('approver', 'admin')
  @ApiOperation({ summary: 'Proxy -> workflow-service POST /workflow/:docId/reject' })
  async reject(@Param('docId') docId: string, @Req() req: any, @Body() body: any) {
    const response = await this.proxyService.forward(req, {
      method: 'POST',
      url: `${process.env.WORKFLOW_SERVICE_URL}/workflow/${docId}/reject`,
      data: body,
    });
    return response.data;
  }
}
