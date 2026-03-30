import {
  Body,
  Controller,
  Delete,
  Param,
  Post,
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

@ApiTags('workflow-proxy')
@ApiBearerAuth()
@ApiSecurity('cookie')
@Controller('workflow')
export class WorkflowProxyController {
  constructor(private readonly proxyService: ProxyService) {}

  /**
   * Submit a DRAFT document for approval.
   * Transitions: **DRAFT → PENDING**
   *
   * After submission, the document enters the approval queue visible to `approver`.
   * The `notification-service` sends alerts to approvers.
   */
  @Post(':docId/submit')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles('editor', 'admin')
  @ApiOperation({
    summary: 'Submit document for approval',
    description:
      'Transitions a **DRAFT** document to **PENDING** status. ' +
      'The document becomes visible in the Approvals queue. ' +
      '**Only the document owner (editor) or admin may submit.**',
  })
  async submit(@Param('docId') docId: string, @Req() req: any) {
    const response = await this.proxyService.forward(req, {
      method: 'POST',
      url: `${process.env.WORKFLOW_SERVICE_URL}/workflow/${docId}/submit`,
    });
    return response.data;
  }

  /**
   * Approve a PENDING document.
   * Transitions: **PENDING → PUBLISHED**
   *
   * After approval, the document is publicly accessible and downloadable by `viewer`.
   */
  @Post(':docId/approve')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles('approver', 'admin')
  @ApiOperation({
    summary: 'Approve document',
    description:
      'Approves a **PENDING** document and transitions it to **PUBLISHED** status. ' +
      'Published documents are accessible to all viewers.',
  })
  async approve(@Param('docId') docId: string, @Req() req: any) {
    const response = await this.proxyService.forward(req, {
      method: 'POST',
      url: `${process.env.WORKFLOW_SERVICE_URL}/workflow/${docId}/approve`,
    });
    return response.data;
  }

  /**
   * Reject a PENDING document.
   * Transitions: **PENDING → DRAFT**
   *
   * The document returns to the editor for revision.
   */
  @Post(':docId/reject')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles('approver', 'admin')
  @ApiOperation({
    summary: 'Reject document',
    description:
      'Rejects a **PENDING** document and returns it to **DRAFT** status. ' +
      'An optional `reason` may be provided in the body.',
  })
  async reject(
    @Param('docId') docId: string,
    @Req() req: any,
    @Body() body: any,
  ) {
    const response = await this.proxyService.forward(req, {
      method: 'POST',
      url: `${process.env.WORKFLOW_SERVICE_URL}/workflow/${docId}/reject`,
      data: body,
    });
    return response.data;
  }

  /**
   * Archive a PUBLISHED document.
   * Transitions: **PUBLISHED → ARCHIVED**
   *
   * Archived documents are removed from public view but retained for audit.
   */
  @Post(':docId/archive')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles('editor', 'admin')
  @ApiOperation({
    summary: 'Archive published document',
    description:
      'Transitions a **PUBLISHED** document to **ARCHIVED** status. ' +
      'Archived documents are no longer publicly accessible. ' +
      '**Only the document owner (editor) or admin may archive.**',
  })
  async archive(@Param('docId') docId: string, @Req() req: any) {
    const response = await this.proxyService.forward(req, {
      method: 'POST',
      url: `${process.env.WORKFLOW_SERVICE_URL}/workflow/${docId}/archive`,
    });
    return response.data;
  }

  @Delete(':docId')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles('editor', 'admin')
  @ApiOperation({
    summary: 'Delete a DRAFT document (soft delete)',
    description:
      'Permanently deletes a **DRAFT** document. ' +
      '**Only the document owner or admin may delete.** ' +
      'Deleted documents are removed from all views but retained in the database.',
  })
  async deleteDocument(@Param('docId') docId: string, @Req() req: any) {
    const response = await this.proxyService.forward(req, {
      method: 'DELETE',
      url: `${process.env.WORKFLOW_SERVICE_URL}/workflow/${docId}`,
    });
    return response.data;
  }
}
