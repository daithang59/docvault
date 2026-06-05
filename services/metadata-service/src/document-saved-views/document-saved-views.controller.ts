import {
  Body,
  Controller,
  Delete,
  Get,
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
import { DocumentSavedViewsService } from './document-saved-views.service';
import { CreateDocumentSavedViewDto } from './dto/create-document-saved-view.dto';

const SAVED_VIEW_ROLES = [
  'viewer',
  'editor',
  'approver',
  'compliance_officer',
  'admin',
] as const;

@ApiTags('document-saved-views')
@ApiBearerAuth()
@Controller('document-saved-views')
@UseGuards(AuthGuard('jwt'), RolesGuard)
@Roles(...SAVED_VIEW_ROLES)
export class DocumentSavedViewsController {
  constructor(private readonly savedViewsService: DocumentSavedViewsService) {}

  @Get()
  @ApiOperation({ summary: 'List private and team document saved views' })
  findAll(@Req() req: any) {
    return this.savedViewsService.findAll(buildRequestContext(req));
  }

  @Post()
  @ApiOperation({ summary: 'Create a document saved view' })
  create(@Body() body: CreateDocumentSavedViewDto, @Req() req: any) {
    return this.savedViewsService.create(body, buildRequestContext(req));
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete a document saved view' })
  delete(@Param('id') id: string, @Req() req: any) {
    return this.savedViewsService.delete(id, buildRequestContext(req));
  }
}
