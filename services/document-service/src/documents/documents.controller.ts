import {
  Body,
  Controller,
  Get,
  HttpCode,
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
import { buildRequestContext } from '../common/request-context';
import { DocumentsService } from './documents.service';
import { PresignDownloadDto } from './dto/presign-download.dto';

@ApiTags('documents')
@ApiBearerAuth()
@Controller('documents')
export class DocumentsController {
  constructor(private readonly documentsService: DocumentsService) {}

  @Post(':docId/upload')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles('editor', 'admin')
  @ApiOperation({ summary: 'Upload a document blob and register a version pointer' })
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      limits: { fileSize: 20 * 1024 * 1024 },
    }),
  )
  upload(
    @Param('docId') docId: string,
    @UploadedFile() file: Express.Multer.File,
    @Req() req: any,
  ) {
    return this.documentsService.upload(
      docId,
      file,
      req.user,
      buildRequestContext(req),
    );
  }

  @Post(':docId/presign-download')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles('viewer', 'editor', 'approver', 'compliance_officer', 'admin')
  @ApiOperation({ summary: 'Create a presigned URL after metadata authorizes download' })
  @HttpCode(200)
  presignDownload(
    @Param('docId') docId: string,
    @Body() body: PresignDownloadDto,
    @Req() req: any,
  ) {
    return this.documentsService.presignDownload(
      docId,
      body,
      buildRequestContext(req),
    );
  }

  @Get(':docId/versions/:version/stream')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles('viewer', 'editor', 'approver', 'compliance_officer', 'admin')
  @ApiOperation({
    summary: 'Stream a document version after metadata authorizes download',
  })
  async streamVersion(
    @Param('docId') docId: string,
    @Param('version') version: string,
    @Req() req: any,
    @Res({ passthrough: true }) res: Response,
  ) {
    const response = await this.documentsService.getStream(
      docId,
      Number(version),
      buildRequestContext(req),
    );

    if (response.contentType) {
      res.setHeader('Content-Type', response.contentType);
    }
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${encodeURIComponent(response.filename)}"`,
    );

    return response.stream;
  }
}
