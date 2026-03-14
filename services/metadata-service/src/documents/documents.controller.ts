import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Req,
  Res,
  StreamableFile,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { Response } from 'express';
import { AuthGuard } from '@nestjs/passport';
import {
  ApiBearerAuth,
  ApiConsumes,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { DocumentsService } from './documents.service';
import { CreateDocumentDto } from './dto/create-document.dto';
import { UploadDocumentDto } from './dto/upload-document.dto';
import { Readable } from 'stream';

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
  @ApiOperation({ summary: 'Create a document record (editor/admin only)' })
  create(@Body() body: CreateDocumentDto, @Req() req: any) {
    return this.documentsService.create(body, req.user);
  }

  @Post('upload')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles('editor', 'admin')
  @ApiOperation({
    summary: 'Upload a document to MinIO and persist metadata (editor/admin only)',
  })
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      limits: { fileSize: 20 * 1024 * 1024 },
    }),
  )
  upload(
    @UploadedFile() file: Express.Multer.File,
    @Body() body: UploadDocumentDto,
    @Req() req: any,
  ) {
    return this.documentsService.uploadDocument(body, file, req.user);
  }

  @Get(':id/download-url')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles('viewer', 'editor', 'approver', 'co', 'admin')
  @ApiOperation({ summary: 'Get presigned download URL (300 s) — CO blocked' })
  getDownloadUrl(@Param('id') id: string, @Req() req: any) {
    return this.documentsService.getDownloadUrl(id, req.user);
  }

  @Get(':id/download')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles('viewer', 'editor', 'approver', 'co', 'admin')
  @ApiOperation({ summary: 'Stream file directly through service — CO blocked' })
  async download(
    @Param('id') id: string,
    @Req() req: any,
    @Res({ passthrough: true }) res: Response,
  ) {
    const { doc, object } = await this.documentsService.getDownloadStream(
      id,
      req.user,
    );

    if (doc.contentType) res.setHeader('Content-Type', doc.contentType);
    if (doc.filename) {
      res.setHeader(
        'Content-Disposition',
        `attachment; filename="${encodeURIComponent(doc.filename)}"`,
      );
    }

    // AWS SDK v3 returns a web ReadableStream; convert to Node.js Readable for StreamableFile
    return new StreamableFile(Readable.fromWeb(object.Body as ReadableStream));
  }
}
