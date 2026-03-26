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
import { ApiBearerAuth, ApiOperation, ApiTags, ApiSecurity } from '@nestjs/swagger';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { ProxyService } from './proxy.service';

@ApiTags('metadata-proxy')
@ApiBearerAuth()
@ApiSecurity('cookie')
@Controller('metadata')
export class MetadataProxyController {
  constructor(private readonly proxyService: ProxyService) {}

  @Get('documents')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles('viewer', 'editor', 'approver', 'compliance_officer', 'admin')
  @ApiOperation({
    summary: 'List all documents (paginated)',
    description: 'Returns a list of documents the current user has access to. ' +
      'Results can be filtered by `status`, `ownerId`, `classification`, `tags`, and `q` (full-text search).',
  })
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
  @ApiOperation({
    summary: 'Get document detail',
    description: 'Returns full document metadata including versions, ACL entries, and workflow history.',
  })
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
  @ApiOperation({
    summary: 'Create a new document (DRAFT)',
    description: 'Creates a new document in **DRAFT** status. ' +
      'After creation, upload a file via `POST /api/documents/:docId/upload`, ' +
      'then submit for review via `POST /api/workflow/:docId/submit`.',
  })
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
    summary: 'Update document metadata',
    description: 'Update title, description, tags, or classification of a DRAFT document.',
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
    summary: 'Add/update ACL entry',
    description: 'Grant or revoke access for a user, role, or group on this document.',
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
  @ApiOperation({ summary: 'Get document ACL' })
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
    summary: 'Register a new file version',
    description: 'Register metadata for a new uploaded file version. ' +
      'The file must first be uploaded via `POST /api/documents/:docId/upload`.',
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
    summary: 'Update document status (workflow transition)',
    description: 'Manually trigger a workflow state transition. ' +
      'Normally transitions are handled by the workflow-service.',
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
  @Roles('viewer', 'editor', 'approver', 'admin')
  @ApiOperation({
    summary: 'Authorize file download',
    description: 'Checks ACL + role policy before allowing a file download. ' +
      '**Note:** `compliance_officer` is **always denied** regardless of ACL — enforced by policy.service.ts.',
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
  @ApiOperation({ summary: 'Get document workflow history' })
  async getWorkflowHistory(@Param('docId') docId: string, @Req() req: any) {
    const response = await this.proxyService.forward(req, {
      method: 'GET',
      url: `${process.env.METADATA_SERVICE_URL}/documents/${docId}/workflow-history`,
    });
    return response.data;
  }
}
