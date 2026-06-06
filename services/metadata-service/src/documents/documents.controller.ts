import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  Put,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { DocumentsService } from './documents.service';
import { CreateDocumentDto } from './dto/create-document.dto';
import { UpdateDocumentDto } from './dto/update-document.dto';
import { LegalHoldDto } from './dto/legal-hold.dto';
import { ApprovalChainDto } from './dto/approval-chain.dto';
import { AclService } from '../acl/acl.service';
import { UpsertAclDto } from '../acl/dto/upsert-acl.dto';
import { VersionsService } from '../versions/versions.service';
import { CreateVersionDto } from '../versions/dto/create-version.dto';
import { StatusService } from '../status/status.service';
import { UpdateStatusDto } from '../status/dto/update-status.dto';
import { PolicyService } from '../policy/policy.service';
import { DownloadAuthorizeDto } from '../policy/dto/download-authorize.dto';
import { PreviewAuthorizeDto } from '../policy/dto/preview-authorize.dto';
import { AccessImpactDto } from '../policy/dto/access-impact.dto';
import { CommentsService } from '../comments/comments.service';
import { buildRequestContext } from '../common/request-context';
import { PrismaService } from '../prisma/prisma.service';

@ApiTags('documents')
@ApiBearerAuth()
@Controller('documents')
export class DocumentsController {
  constructor(
    private readonly documentsService: DocumentsService,
    private readonly aclService: AclService,
    private readonly versionsService: VersionsService,
    private readonly statusService: StatusService,
    private readonly policyService: PolicyService,
    private readonly commentsService: CommentsService,
    private readonly prisma: PrismaService,
  ) {}

  @Get()
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles('viewer', 'editor', 'approver', 'compliance_officer', 'admin')
  @ApiOperation({ summary: 'List document metadata records (ACL-filtered)' })
  findAll(@Req() req: any, @Query('q') q?: string) {
    return this.documentsService.findAll(buildRequestContext(req), q);
  }

  @Get('trash')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles('editor', 'admin')
  @ApiOperation({
    summary: 'List soft-deleted documents (trash) with recovery deadlines',
  })
  listTrash(@Req() req: any) {
    return this.documentsService.listTrash(buildRequestContext(req));
  }

  @Post(':docId/restore')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles('editor', 'admin')
  @ApiOperation({
    summary: 'Restore a soft-deleted document back to DRAFT within the recovery window',
  })
  restoreFromTrash(@Param('docId') docId: string, @Req() req: any) {
    return this.documentsService.restoreFromTrash(docId, buildRequestContext(req));
  }

  @Get(':docId')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles('viewer', 'editor', 'approver', 'compliance_officer', 'admin')
  @ApiOperation({ summary: 'Get a document metadata record by id' })
  findOne(@Param('docId') docId: string, @Req() req: any) {
    return this.policyService.assertCanReadMetadata(
      docId,
      req.user,
      buildRequestContext(req),
    );
  }

  @Get(':docId/ai-guardrails')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles('viewer', 'editor', 'approver', 'compliance_officer', 'admin')
  @ApiOperation({
    summary: 'Get AI-ready access guardrails for a document',
    description:
      'Returns metadata/content policy decisions for future AI classification, tagging, summarization, and QA. It never returns file content, object keys, presigned URLs, preview grants, or download grants.',
  })
  getAiGuardrails(@Param('docId') docId: string, @Req() req: any) {
    return this.policyService.getAiGuardrails(
      docId,
      req.user,
      buildRequestContext(req),
    );
  }

  @Post(':docId/access-impact')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles('editor', 'admin')
  @HttpCode(200)
  @ApiOperation({
    summary: 'Preview access impact for a proposed metadata policy change',
    description:
      'Simulates baseline role access changes for a proposed document classification without returning file content, object keys, presigned URLs, or grant tokens.',
  })
  getAccessImpactPreview(
    @Param('docId') docId: string,
    @Body() body: AccessImpactDto,
    @Req() req: any,
  ) {
    return this.policyService.getAccessImpactPreview(
      docId,
      body,
      req.user,
      buildRequestContext(req),
    );
  }

  @Post()
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles('editor', 'admin')
  @ApiOperation({ summary: 'Create a document metadata record' })
  create(@Body() body: CreateDocumentDto, @Req() req: any) {
    return this.documentsService.create(
      body,
      req.user,
      buildRequestContext(req),
    );
  }

  @Patch(':docId')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles('editor', 'admin')
  @ApiOperation({ summary: 'Update metadata fields owned by metadata service' })
  update(
    @Param('docId') docId: string,
    @Body() body: UpdateDocumentDto,
    @Req() req: any,
  ) {
    return this.documentsService.update(
      docId,
      body,
      req.user,
      buildRequestContext(req),
    );
  }

  @Post(':docId/approval-chain')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles('editor', 'admin')
  @ApiOperation({
    summary: 'Set an ordered approval chain for a document',
  })
  setApprovalChain(
    @Param('docId') docId: string,
    @Body() body: ApprovalChainDto,
    @Req() req: any,
  ) {
    return this.documentsService.setApprovalChain(docId, body, buildRequestContext(req));
  }

  @Post(':docId/approval-step/advance')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles('approver', 'admin')
  @ApiOperation({
    summary: 'Advance the approval chain to the next step (internal, used by workflow)',
  })
  advanceApprovalStep(@Param('docId') docId: string, @Req() req: any) {
    return this.documentsService.advanceApprovalStep(docId, buildRequestContext(req));
  }

  @Post(':docId/legal-hold')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles('admin')
  @ApiOperation({
    summary: 'Place or release a legal hold on a document',
    description:
      'Admin-only. While a legal hold is active, the retention job will not auto-archive the document. Placing a hold requires a reason.',
  })
  setLegalHold(
    @Param('docId') docId: string,
    @Body() body: LegalHoldDto,
    @Req() req: any,
  ) {
    return this.documentsService.setLegalHold(
      docId,
      body,
      buildRequestContext(req),
    );
  }

  @Post(':docId/acl')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles('editor', 'admin')
  @ApiOperation({ summary: 'Add an ACL rule for a document' })
  upsertAcl(
    @Param('docId') docId: string,
    @Body() body: UpsertAclDto,
    @Req() req: any,
  ) {
    return this.aclService.upsert(
      docId,
      body,
      req.user,
      buildRequestContext(req),
    );
  }

  @Get(':docId/acl')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles('editor', 'approver', 'compliance_officer', 'admin')
  @ApiOperation({ summary: 'List ACL rules for a document' })
  async listAcl(@Param('docId') docId: string, @Req() req: any) {
    await this.policyService.assertCanReadMetadata(
      docId,
      req.user,
      buildRequestContext(req),
    );
    return this.aclService.list(docId);
  }

  @Delete(':docId/acl/:aclId')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles('editor', 'admin')
  @ApiOperation({ summary: 'Delete an ACL rule from a document' })
  deleteAcl(
    @Param('docId') docId: string,
    @Param('aclId') aclId: string,
    @Req() req: any,
  ) {
    return this.aclService.delete(
      docId,
      aclId,
      req.user,
      buildRequestContext(req),
    );
  }

  @Post(':docId/versions')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles('editor', 'admin')
  @ApiOperation({ summary: 'Register a new document version pointer' })
  createVersion(
    @Param('docId') docId: string,
    @Body() body: CreateVersionDto,
    @Req() req: any,
  ) {
    return this.versionsService.create(docId, body, req.user);
  }

  @Post(':docId/versions/:version/restore')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles('editor', 'admin')
  @ApiOperation({
    summary: 'Restore a previous version as a new current version',
    description:
      'Owner editor or admin only. Creates a new version that re-points to the chosen older version file, preserving full history.',
  })
  restoreVersion(
    @Param('docId') docId: string,
    @Param('version') version: string,
    @Req() req: any,
  ) {
    return this.versionsService.restore(docId, Number(version), req.user);
  }

  @Post(':docId/status')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles('editor', 'approver', 'admin')
  @ApiOperation({ summary: 'Update document status via workflow action' })
  updateStatus(
    @Param('docId') docId: string,
    @Body() body: UpdateStatusDto,
    @Req() req: any,
  ) {
    return this.statusService.update(
      docId,
      body,
      req.user,
      buildRequestContext(req),
    );
  }

  @Get(':docId/workflow-history')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles('viewer', 'editor', 'approver', 'compliance_officer', 'admin')
  @ApiOperation({ summary: 'List workflow history for a document' })
  async getWorkflowHistory(@Param('docId') docId: string, @Req() req: any) {
    await this.policyService.assertCanReadMetadata(
      docId,
      req.user,
      buildRequestContext(req),
    );
    return this.prisma.documentWorkflowHistory.findMany({
      where: { docId },
      orderBy: { createdAt: 'desc' },
    });
  }

  @Get(':docId/approvers')
  @ApiOperation({
    summary: 'Get approver+admin user IDs for notification routing',
    description:
      'Returns the IDs of all users who have approver or admin role. ' +
      'Used internally by the workflow service to route SUBMITTED notifications. ' +
      'No auth required — returns only user IDs, no sensitive data.',
  })
  getApprovers() {
    // docId is required by REST convention; the result is global role membership.
    return this.documentsService.getApprovers();
  }

  @Post(':docId/download-authorize')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles('viewer', 'editor', 'approver', 'admin')
  @ApiOperation({
    summary: 'Authorize a download using metadata status and ACL policy',
  })
  @HttpCode(200)
  authorizeDownload(
    @Param('docId') docId: string,
    @Body() body: DownloadAuthorizeDto,
    @Req() req: any,
  ) {
    return this.policyService.authorizeDownload(
      docId,
      body,
      req.user,
      buildRequestContext(req),
      { shareToken: body.shareToken },
    );
  }

  @Post(':docId/preview-authorize')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles('viewer', 'editor', 'approver', 'admin')
  @ApiOperation({
    summary:
      'Authorize a document preview using metadata status and ACL policy',
  })
  @HttpCode(200)
  authorizePreview(
    @Param('docId') docId: string,
    @Body() body: PreviewAuthorizeDto,
    @Req() req: any,
  ) {
    return this.policyService.authorizePreview(
      docId,
      body,
      req.user,
      buildRequestContext(req),
      { shareToken: body.shareToken },
    );
  }

  @Get(':docId/comments')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles('viewer', 'editor', 'approver', 'compliance_officer', 'admin')
  @ApiOperation({ summary: 'List comments for a document' })
  async listComments(@Param('docId') docId: string, @Req() req: any) {
    await this.policyService.assertCanReadMetadata(
      docId,
      req.user,
      buildRequestContext(req),
    );
    return this.commentsService.findByDoc(docId);
  }

  @Post(':docId/comments')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles('viewer', 'editor', 'approver', 'compliance_officer', 'admin')
  @ApiOperation({ summary: 'Add a comment to a document' })
  async addComment(
    @Param('docId') docId: string,
    @Body() body: { content: string },
    @Req() req: any,
  ) {
    await this.policyService.assertCanReadMetadata(
      docId,
      req.user,
      buildRequestContext(req),
    );
    return this.commentsService.create(
      docId,
      body.content,
      req.user,
      buildRequestContext(req),
    );
  }

  @Put(':docId/comments/:commentId')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles('viewer', 'editor', 'approver', 'compliance_officer', 'admin')
  @ApiOperation({ summary: 'Update a comment' })
  async updateComment(
    @Param('docId') docId: string,
    @Param('commentId') commentId: string,
    @Body() body: { content: string },
    @Req() req: any,
  ) {
    const context = buildRequestContext(req);
    await this.policyService.assertCanReadMetadata(docId, req.user, context);
    return this.commentsService.update(
      docId,
      commentId,
      body.content,
      req.user,
      context,
    );
  }

  @Delete(':docId/comments/:commentId')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles('viewer', 'editor', 'approver', 'compliance_officer', 'admin')
  @ApiOperation({ summary: 'Delete a comment' })
  async deleteComment(
    @Param('docId') docId: string,
    @Param('commentId') commentId: string,
    @Req() req: any,
  ) {
    const context = buildRequestContext(req);
    await this.policyService.assertCanReadMetadata(docId, req.user, context);
    return this.commentsService.delete(docId, commentId, req.user, context);
  }
}
