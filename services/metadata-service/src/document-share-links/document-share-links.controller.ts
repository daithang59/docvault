import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { buildRequestContext } from '../common/request-context';
import { DocumentShareLinksService } from './document-share-links.service';
import { CreateShareLinkDto } from './dto/create-share-link.dto';

@ApiTags('document-share-links')
@ApiBearerAuth()
@Controller()
export class DocumentShareLinksController {
  constructor(private readonly service: DocumentShareLinksService) {}

  @Post('documents/:docId/share-links')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles('editor', 'admin')
  @ApiOperation({
    summary: 'Create a time-limited share link for a document',
    description:
      'Issues a single-use-revealed token. Only the owner editor or an admin can create links. The raw token is returned once and never stored.',
  })
  create(
    @Param('docId') docId: string,
    @Body() body: CreateShareLinkDto,
    @Req() req: any,
  ) {
    return this.service.create(docId, body, buildRequestContext(req));
  }

  @Get('documents/:docId/share-links')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles('editor', 'admin')
  @ApiOperation({ summary: 'List share links for a document' })
  list(@Param('docId') docId: string, @Req() req: any) {
    return this.service.list(docId, buildRequestContext(req));
  }

  @Delete('documents/:docId/share-links/:linkId')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles('editor', 'admin')
  @ApiOperation({ summary: 'Revoke a share link' })
  revoke(
    @Param('docId') docId: string,
    @Param('linkId') linkId: string,
    @Req() req: any,
  ) {
    return this.service.revoke(docId, linkId, buildRequestContext(req));
  }

  @Post('share-links/redeem')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles('viewer', 'editor', 'approver', 'admin')
  @HttpCode(200)
  @ApiOperation({
    summary: 'Redeem a share link token (authenticated recipient)',
    description:
      'Validates a share token and returns document context. The recipient must be authenticated; this grants scoped access bypassing ACL for the linked document only.',
  })
  redeem(@Body() body: { token: string }, @Req() req: any) {
    return this.service.redeem(body?.token, buildRequestContext(req));
  }
}
