import {
  Body,
  Controller,
  Get,
  HttpCode,
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
import { ProxyService } from './proxy.service';

@ApiTags('metadata-proxy')
@ApiBearerAuth()
@Controller('metadata')
export class MetadataProxyController {
  constructor(private readonly proxyService: ProxyService) {}

  @Get('documents')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles('viewer', 'editor', 'approver', 'compliance_officer', 'admin')
  @ApiOperation({ summary: 'Proxy -> metadata-service GET /documents' })
  async list(@Req() req: any) {
    const response = await this.proxyService.forward(req, {
      method: 'GET',
      url: `${process.env.METADATA_SERVICE_URL}/documents`,
    });
    return response.data;
  }

  @Get('documents/:docId')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles('viewer', 'editor', 'approver', 'compliance_officer', 'admin')
  @ApiOperation({ summary: 'Proxy -> metadata-service GET /documents/:docId' })
  async findOne(@Param('docId') docId: string, @Req() req: any) {
    const response = await this.proxyService.forward(req, {
      method: 'GET',
      url: `${process.env.METADATA_SERVICE_URL}/documents/${docId}`,
    });
    return response.data;
  }

  @Post('documents')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles('editor', 'admin')
  @ApiOperation({ summary: 'Proxy -> metadata-service POST /documents' })
  async create(@Req() req: any, @Body() body: any) {
    const response = await this.proxyService.forward(req, {
      method: 'POST',
      url: `${process.env.METADATA_SERVICE_URL}/documents`,
      data: body,
    });
    return response.data;
  }

  @Patch('documents/:docId')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles('editor', 'admin')
  @ApiOperation({
    summary: 'Proxy -> metadata-service PATCH /documents/:docId',
  })
  async update(
    @Param('docId') docId: string,
    @Req() req: any,
    @Body() body: any,
  ) {
    const response = await this.proxyService.forward(req, {
      method: 'PATCH',
      url: `${process.env.METADATA_SERVICE_URL}/documents/${docId}`,
      data: body,
    });
    return response.data;
  }

  @Post('documents/:docId/acl')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles('editor', 'admin')
  @ApiOperation({
    summary: 'Proxy -> metadata-service POST /documents/:docId/acl',
  })
  async upsertAcl(
    @Param('docId') docId: string,
    @Req() req: any,
    @Body() body: any,
  ) {
    const response = await this.proxyService.forward(req, {
      method: 'POST',
      url: `${process.env.METADATA_SERVICE_URL}/documents/${docId}/acl`,
      data: body,
    });
    return response.data;
  }

  @Get('documents/:docId/acl')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles('editor', 'approver', 'compliance_officer', 'admin')
  @ApiOperation({
    summary: 'Proxy -> metadata-service GET /documents/:docId/acl',
  })
  async listAcl(@Param('docId') docId: string, @Req() req: any) {
    const response = await this.proxyService.forward(req, {
      method: 'GET',
      url: `${process.env.METADATA_SERVICE_URL}/documents/${docId}/acl`,
    });
    return response.data;
  }

  @Post('documents/:docId/versions')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles('editor', 'admin')
  @ApiOperation({
    summary: 'Proxy -> metadata-service POST /documents/:docId/versions',
  })
  async createVersion(
    @Param('docId') docId: string,
    @Req() req: any,
    @Body() body: any,
  ) {
    const response = await this.proxyService.forward(req, {
      method: 'POST',
      url: `${process.env.METADATA_SERVICE_URL}/documents/${docId}/versions`,
      data: body,
    });
    return response.data;
  }

  @Post('documents/:docId/status')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles('editor', 'approver', 'admin')
  @ApiOperation({
    summary: 'Proxy -> metadata-service POST /documents/:docId/status',
  })
  async updateStatus(
    @Param('docId') docId: string,
    @Req() req: any,
    @Body() body: any,
  ) {
    const response = await this.proxyService.forward(req, {
      method: 'POST',
      url: `${process.env.METADATA_SERVICE_URL}/documents/${docId}/status`,
      data: body,
    });
    return response.data;
  }

  @Post('documents/:docId/download-authorize')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles('viewer', 'editor', 'approver', 'compliance_officer', 'admin')
  @ApiOperation({
    summary:
      'Proxy -> metadata-service POST /documents/:docId/download-authorize',
  })
  @HttpCode(200)
  async authorizeDownload(
    @Param('docId') docId: string,
    @Req() req: any,
    @Body() body: any,
  ) {
    const response = await this.proxyService.forward(req, {
      method: 'POST',
      url: `${process.env.METADATA_SERVICE_URL}/documents/${docId}/download-authorize`,
      data: body,
    });
    return response.data;
  }
  @Get('documents/:docId/workflow-history')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles('viewer', 'editor', 'approver', 'compliance_officer', 'admin')
  @ApiOperation({
    summary:
      'Proxy -> metadata-service GET /documents/:docId/workflow-history',
  })
  async getWorkflowHistory(@Param('docId') docId: string, @Req() req: any) {
    const response = await this.proxyService.forward(req, {
      method: 'GET',
      url: `${process.env.METADATA_SERVICE_URL}/documents/${docId}/workflow-history`,
    });
    return response.data;
  }
}
