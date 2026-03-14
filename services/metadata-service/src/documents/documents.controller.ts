import { Body, Controller, Get, Post, Req, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { DocumentsService } from './documents.service';
import { CreateDocumentDto } from './dto/create-document.dto';

@ApiTags('documents')
@ApiBearerAuth()
@Controller('documents')
export class DocumentsController {
  constructor(private readonly documentsService: DocumentsService) {}

  @Get()
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles('viewer', 'editor', 'approver', 'co', 'admin')
  @ApiOperation({ summary: 'List all documents (all authenticated roles)' })
  findAll() {
    return this.documentsService.findAll();
  }

  @Post()
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles('editor', 'admin')
  @ApiOperation({ summary: 'Create a document (editor/admin only)' })
  create(@Body() body: CreateDocumentDto, @Req() req: any) {
    return this.documentsService.create(body, req.user);
  }
}
