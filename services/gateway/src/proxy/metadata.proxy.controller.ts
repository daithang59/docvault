import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  Patch,
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
    description:
      'Returns a list of documents the current user has access to. ' +
      'Results can be filtered by `status`, `ownerId`, `classification`, `tags`, and `q` (full-text search).',
  })
  async list(@Req() req: any) {
    // Forward query params (e.g. ?q=keyword) to the downstream service
    const queryString = req.url.includes('?')
      ? req.url.substring(req.url.indexOf('?'))
      : '';
    const response = await this.proxyService.forward(req, {
      method: 'GET',
      url: `${process.env.METADATA_SERVICE_URL}/documents${queryString}`,
    });
    return response.data;
  }

  @Get('retention/documents')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles('compliance_officer', 'admin')
  @ApiOperation({
    summary: 'List retention evidence',
    description:
      'Returns records-management evidence for published and archived documents, including retention class, retention deadline, and computed status.',
  })
  async listRetention(@Req() req: any, @Query('asOf') _asOf?: string) {
    const queryString = req.url.includes('?')
      ? req.url.substring(req.url.indexOf('?'))
      : '';
    const response = await this.proxyService.forward(req, {
      method: 'GET',
      url: `${process.env.METADATA_SERVICE_URL}/retention/documents${queryString}`,
    });
    return response.data;
  }

  @Post('retention/run')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles('admin')
  @HttpCode(200)
  @ApiOperation({
    summary: 'Run retention auto-archive',
    description:
      'Admin-only demo endpoint that runs the retention job. Optional `asOf` query parameter can be used as a deterministic demo clock.',
  })
  async runRetention(@Req() req: any, @Query('asOf') _asOf?: string) {
    const queryString = req.url.includes('?')
      ? req.url.substring(req.url.indexOf('?'))
      : '';
    const response = await this.proxyService.forward(req, {
      method: 'POST',
      url: `${process.env.METADATA_SERVICE_URL}/retention/run${queryString}`,
    });
    return response.data;
  }

  @Get('documents/:docId')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles('viewer', 'editor', 'approver', 'compliance_officer', 'admin')
  @ApiOperation({
    summary: 'Get document detail',
    description:
      'Returns full document metadata including versions, ACL entries, and workflow history.',
  })
  async findOne(@Param('docId') docId: string, @Req() req: any) {
    const response = await this.proxyService.forward(req, {
      method: 'GET',
      url: `${process.env.METADATA_SERVICE_URL}/documents/${docId}`,
    });
    return response.data;
  }

  @Get('documents/:docId/evidence-packet')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles('compliance_officer', 'admin')
  @ApiOperation({
    summary: 'Export document compliance evidence packet',
    description:
      'Builds a document-scoped JSON packet with metadata, versions, ACL, workflow history, retention evidence, audit hash-chain status, and related audit events.',
  })
  async getEvidencePacket(
    @Param('docId') docId: string,
    @Req() req: any,
    @Query('asOf') asOf?: string,
  ) {
    const documentResponse = await this.proxyService.forward(req, {
      method: 'GET',
      url: `${process.env.METADATA_SERVICE_URL}/documents/${docId}`,
    });
    const document = documentResponse.data ?? {};

    const [workflowResponse, retentionResponse, chainResponse, auditResponse] =
      await Promise.all([
        this.proxyService.forward(req, {
          method: 'GET',
          url: `${process.env.METADATA_SERVICE_URL}/documents/${docId}/workflow-history`,
        }),
        this.proxyService.forward(req, {
          method: 'GET',
          url: `${process.env.METADATA_SERVICE_URL}/retention/documents`,
          ...(asOf ? { params: { asOf } } : {}),
        }),
        this.proxyService.forward(req, {
          method: 'GET',
          url: `${process.env.AUDIT_SERVICE_URL}/audit/verify-chain`,
          params: { limit: 5000 },
        }),
        this.proxyService.forward(req, {
          method: 'GET',
          url: `${process.env.AUDIT_SERVICE_URL}/audit/query`,
          params: { documentId: docId, pageSize: 200 },
        }),
      ]);

    const {
      versions = [],
      aclEntries,
      acl,
      workflowHistory: _embeddedWorkflowHistory,
      ...documentMetadata
    } = document;
    const retentionRecords = Array.isArray(retentionResponse.data?.records)
      ? retentionResponse.data.records
      : [];
    const auditEvents = Array.isArray(auditResponse.data?.data)
      ? auditResponse.data.data
      : [];

    return {
      generatedAt: new Date().toISOString(),
      generatedBy: {
        id: req.user?.sub ?? req.user?.username ?? null,
        username: req.user?.username ?? null,
        roles: Array.isArray(req.user?.roles) ? req.user.roles : [],
      },
      scope: {
        type: 'DOCUMENT',
        documentId: docId,
        asOf: asOf ?? null,
      },
      document: documentMetadata,
      versions,
      aclEntries: aclEntries ?? acl ?? [],
      workflowHistory: Array.isArray(workflowResponse.data)
        ? workflowResponse.data
        : [],
      retention: {
        checkedAt: retentionResponse.data?.checkedAt ?? null,
        summary: retentionResponse.data?.summary ?? null,
        record:
          retentionRecords.find((record: any) => record.docId === docId) ??
          null,
        fields: {
          retentionClass: document.retentionClass ?? null,
          retentionUntil: document.retentionUntil ?? null,
          retentionReason: document.retentionReason ?? null,
        },
      },
      audit: {
        chain: chainResponse.data,
        events: auditEvents,
        total: auditResponse.data?.total ?? auditEvents.length,
        page: auditResponse.data?.page ?? 1,
        pageSize: auditResponse.data?.pageSize ?? auditEvents.length,
      },
    };
  }

  @Post('documents')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles('editor', 'admin')
  @ApiOperation({
    summary: 'Create a new document (DRAFT)',
    description:
      'Creates a new document in **DRAFT** status. ' +
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
    description:
      'Update title, description, tags, or classification of a DRAFT document.',
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
    description:
      'Grant or revoke access for a user, role, or group on this document.',
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
    description:
      'Register metadata for a new uploaded file version. ' +
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
    description:
      'Manually trigger a workflow state transition. ' +
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
    description:
      'Checks ACL + role policy before allowing a file download. ' +
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

  @Post('documents/:docId/preview-authorize')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles('viewer', 'editor', 'approver', 'admin')
  @ApiOperation({
    summary: 'Authorize document preview',
    description:
      'Issues a preview grant token for file content access. ' +
      'Compliance officers may inspect metadata and audit events, but cannot preview, stream, presign, or download file content.',
  })
  @HttpCode(200)
  async authorizePreview(
    @Param('docId') docId: string,
    @Req() req: any,
    @Body() body: any,
  ) {
    const response = await this.proxyService.forward(req, {
      method: 'POST',
      url: `${process.env.METADATA_SERVICE_URL}/documents/${docId}/preview-authorize`,
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

  @Get('documents/:docId/comments')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles('viewer', 'editor', 'approver', 'compliance_officer', 'admin')
  @ApiOperation({ summary: 'List comments for a document' })
  async listComments(@Param('docId') docId: string, @Req() req: any) {
    const response = await this.proxyService.forward(req, {
      method: 'GET',
      url: `${process.env.METADATA_SERVICE_URL}/documents/${docId}/comments`,
    });
    return response.data;
  }

  @Post('documents/:docId/comments')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles('viewer', 'editor', 'approver', 'compliance_officer', 'admin')
  @ApiOperation({ summary: 'Add a comment to a document' })
  async addComment(
    @Param('docId') docId: string,
    @Req() req: any,
    @Body() body: any,
  ) {
    const response = await this.proxyService.forward(req, {
      method: 'POST',
      url: `${process.env.METADATA_SERVICE_URL}/documents/${docId}/comments`,
      data: body,
    });
    return response.data;
  }
}
