import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Query,
  Req,
  Res,
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
  @ApiOperation({
    summary: 'Upload a document blob and register a version pointer',
  })
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
  @ApiOperation({
    summary: 'Create a presigned URL after metadata authorizes download',
  })
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
    summary: 'Stream a document version by grant token (already authorized, no metadata call)',
  })
  async streamVersion(
    @Param('docId') docId: string,
    @Param('version') version: string,
    @Query('token') token: string,
    @Req() req: any,
    @Res({ passthrough: true }) res: Response,
  ) {
    const context = buildRequestContext(req);

    try {
      const response = await this.documentsService.getStreamWithToken(
        docId,
        token,
        context.actorId,
      );

      if (response.contentType) {
        res.setHeader('Content-Type', response.contentType);
      }
      res.setHeader(
        'Content-Disposition',
        `attachment; filename="${encodeURIComponent(response.filename)}"`,
      );

      return response.stream;
    } catch (err) {
      console.error('[StreamVersion] Error streaming document:', (err as Error).message, (err as Error).stack);
      throw err;
    }
  }

  @Get(':docId/preview')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles('viewer', 'editor', 'approver', 'compliance_officer', 'admin')
  @ApiOperation({
    summary: 'Stream a document for inline preview (supports Range requests)',
  })
  async preview(
    @Param('docId') docId: string,
    @Query('version') version: string,
    @Req() req: any,
    @Res() res: Response,
  ) {
    // Parse Range header (e.g. "bytes=0-1023")
    const rangeHeader = req.headers['range'];
    let range: { start: number; end: number } | undefined;
    if (rangeHeader) {
      const match = rangeHeader.match(/bytes=(\d+)-(\d+)/);
      if (match) {
        range = { start: Number(match[1]), end: Number(match[2]) };
      }
    }

    const parsedVersion = version ? Number(version) : undefined;

    const result = await this.documentsService.preview({
      docId,
      version: parsedVersion,
      range,
      context: buildRequestContext(req),
    });

    if (result.contentType) {
      res.setHeader('Content-Type', result.contentType);
    }
    res.setHeader(
      'Content-Disposition',
      `inline; filename="${encodeURIComponent(result.filename)}"`,
    );
    res.setHeader('Accept-Ranges', 'bytes');

    const sdkResponse = result.object as any;

    if (range && sdkResponse.ContentRange) {
      // 206 Partial Content
      res.status(HttpStatus.PARTIAL_CONTENT);
      res.setHeader('Content-Range', sdkResponse.ContentRange);
      res.setHeader(
        'Content-Length',
        sdkResponse.ContentLength ?? range.end - range.start + 1,
      );
    } else {
      // 200 OK
      if (sdkResponse.ContentLength) {
        res.setHeader('Content-Length', sdkResponse.ContentLength);
      }
    }

    // Pipe MinIO stream directly to HTTP response (zero RAM)
    const bodyStream = sdkResponse.Body as NodeJS.ReadableStream;

    bodyStream.on('error', (err: Error) => {
      if (!res.headersSent) {
        res.status(500).json({ message: ['Preview stream failed'], detail: err.message });
      } else {
        res.destroy(err);
      }
    });

    bodyStream.pipe(res);
    return;
  }
}
