import { Controller, Get, Post, Body, Req, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Roles } from './auth/roles.decorator';
import { RolesGuard } from './auth/roles.guard';

type CreateDocumentDto = {
  title: string;
  description?: string;
};

type DocumentRecord = {
  id: string;
  title: string;
  description?: string;
  owner: string;
  status: string;
};

@ApiTags('documents')
@ApiBearerAuth()
@Controller()
export class AppController {
  private readonly docs: DocumentRecord[] = [
    { id: '1', title: 'Doc A', owner: 'editor1', status: 'draft' },
    { id: '2', title: 'Doc B', owner: 'approver1', status: 'approved' },
  ];

  @Get('health')
  @ApiOperation({ summary: 'Health check' })
  health() {
    return { status: 'ok', service: 'metadata-service' };
  }

  @Get('me')
  @UseGuards(AuthGuard('jwt'))
  @ApiOperation({ summary: 'Return current user info from token' })
  me(@Req() req: any) {
    return req.user;
  }

  /** viewer, editor, approver, co, admin can list */
  @Get('documents')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles('viewer', 'editor', 'approver', 'co', 'admin')
  @ApiOperation({ summary: 'List all documents (all authenticated roles)' })
  listDocuments() {
    return this.docs;
  }

  /** Only editor or admin can create */
  @Post('documents')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles('editor', 'admin')
  @ApiOperation({ summary: 'Create a document (editor/admin only)' })
  createDocument(@Body() body: CreateDocumentDto, @Req() req: any) {
    const created: DocumentRecord = {
      id: String(this.docs.length + 1),
      title: body.title,
      description: body.description ?? '',
      owner: (req.user as any).username,
      status: 'draft',
    };

    this.docs.push(created);
    return created;
  }

  /** Only co or admin can see compliance view */
  @Get('documents/audit-view')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles('co', 'admin')
  @ApiOperation({ summary: 'Audit/compliance view (co/admin only)' })
  auditView() {
    return {
      ok: true,
      message: 'CO/Admin can inspect metadata and audit-oriented views',
    };
  }
}
