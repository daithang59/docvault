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
import { DocumentsService } from './documents.service';
import { CreateDocumentDto } from './dto/create-document.dto';
import { UpdateDocumentDto } from './dto/update-document.dto';
import { AclService } from '../acl/acl.service';
import { UpsertAclDto } from '../acl/dto/upsert-acl.dto';
import { VersionsService } from '../versions/versions.service';
import { CreateVersionDto } from '../versions/dto/create-version.dto';
import { StatusService } from '../status/status.service';
import { UpdateStatusDto } from '../status/dto/update-status.dto';
import { PolicyService } from '../policy/policy.service';
import { DownloadAuthorizeDto } from '../policy/dto/download-authorize.dto';
import { PreviewAuthorizeDto } from '../policy/dto/preview-authorize.dto';
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
    private readonly prisma: PrismaService,
  ) {}

  @Get()
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles('viewer', 'editor', 'approver', 'compliance_officer', 'admin')
  @ApiOperation({ summary: 'List document metadata records (ACL-filtered)' })
  findAll(@Req() req: any) {
    return this.documentsService.findAll(buildRequestContext(req));
  }

  @Get(':docId')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles('viewer', 'editor', 'approver', 'compliance_officer', 'admin')
  @ApiOperation({ summary: 'Get a document metadata record by id' })
  findOne(@Param('docId') docId: string) {
    return this.documentsService.findOneOrThrow(docId);
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
  listAcl(@Param('docId') docId: string) {
    return this.aclService.list(docId);
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
    return this.versionsService.create(
      docId,
      body,
      req.user,
      buildRequestContext(req),
    );
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
  getWorkflowHistory(@Param('docId') docId: string) {
    return this.prisma.documentWorkflowHistory.findMany({
      where: { docId },
      orderBy: { createdAt: 'desc' },
    });
  }

  @Post(':docId/download-authorize')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles('viewer', 'editor', 'approver', 'compliance_officer', 'admin')
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
    );
  }

  @Post(':docId/preview-authorize')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles('viewer', 'editor', 'approver', 'compliance_officer', 'admin')
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
    );
  }
}
