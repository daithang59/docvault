import { Body, Controller, Param, Post, Req, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { buildRequestContext } from '../common/request-context';
import { RejectWorkflowDto } from './dto/reject-workflow.dto';
import { WorkflowService } from './workflow.service';

@ApiTags('workflow')
@ApiBearerAuth()
@Controller('workflow')
export class WorkflowController {
  constructor(private readonly workflowService: WorkflowService) {}

  @Post(':docId/submit')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles('editor', 'admin')
  @ApiOperation({ summary: 'Submit a document from DRAFT to PENDING' })
  submit(@Param('docId') docId: string, @Req() req: any) {
    return this.workflowService.submit(
      docId,
      req.user,
      buildRequestContext(req),
    );
  }

  @Post(':docId/approve')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles('approver', 'admin')
  @ApiOperation({ summary: 'Approve a document from PENDING to PUBLISHED' })
  approve(@Param('docId') docId: string, @Req() req: any) {
    return this.workflowService.approve(
      docId,
      req.user,
      buildRequestContext(req),
    );
  }

  @Post(':docId/reject')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles('approver', 'admin')
  @ApiOperation({ summary: 'Reject a document from PENDING back to DRAFT' })
  reject(
    @Param('docId') docId: string,
    @Body() body: RejectWorkflowDto,
    @Req() req: any,
  ) {
    return this.workflowService.reject(
      docId,
      body.reason,
      req.user,
      buildRequestContext(req),
    );
  }

  @Post(':docId/archive')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles('editor', 'admin')
  @ApiOperation({ summary: 'Archive a PUBLISHED document' })
  archive(@Param('docId') docId: string, @Req() req: any) {
    return this.workflowService.archive(
      docId,
      req.user,
      buildRequestContext(req),
    );
  }
}
