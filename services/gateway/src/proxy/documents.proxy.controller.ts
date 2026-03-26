import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  Post,
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
  ApiSecurity,
} from '@nestjs/swagger';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { ProxyService } from './proxy.service';
// eslint-disable-next-line @typescript-eslint/no-require-imports
const FormData = require('form-data') as typeof import('form-data');

@ApiTags('documents-proxy')
@ApiBearerAuth()
@ApiSecurity('cookie')
@Controller('documents')
export class DocumentsProxyController {
  constructor(private readonly proxyService: ProxyService) {}

  /**
   * Upload a file for a document.
   *
   * The file is stored in **MinIO** (S3-compatible object storage).
   * After upload, call `POST /api/metadata/documents/:docId/versions` to register
   * the version metadata, then `POST /api/workflow/:docId/submit` to request approval.
   *
   * Max file size: **20 MB**
   */
  @Post(':docId/upload')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles('editor', 'admin')
  @ApiConsumes('multipart/form-data')
  @ApiOperation({
    summary: 'Upload a file to document',
    description:
      'Upload a binary file (max 20 MB) to MinIO storage for the given document. ' +
      'After upload, register the version via `POST /api/metadata/documents/:docId/versions`.',
  })
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      limits: { fileSize: 20 * 1024 * 1024 },
    }),
  )
  async upload(
    @Param('docId') docId: string,
    @Req() req: any,
    @UploadedFile() file: Express.Multer.File,
  ) {
    const form = new FormData();
    form.append('file', file.buffer, {
      filename: file.originalname,
      contentType: file.mimetype,
    });

    const response = await this.proxyService.forward(req, {
      method: 'POST',
      url: `${process.env.DOCUMENT_SERVICE_URL}/documents/${docId}/upload`,
      data: form,
      headers: form.getHeaders(),
    });

    return response.data;
  }

  /**
   * Request a presigned download URL for a file.
   *
   * **Note:** `compliance_officer` is **always denied** — enforced at the policy layer.
   * For PUBLISHED documents, `viewer` can download directly.
   * For non-PUBLISHED documents, ACL checks apply.
   */
  @Post(':docId/presign-download')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles('viewer', 'editor', 'approver', 'admin')
  @ApiOperation({
    summary: 'Get presigned download URL',
    description:
      'Returns a time-limited presigned URL from MinIO for direct file download. ' +
      '**compliance_officer is always denied regardless of ACL.**',
  })
  @HttpCode(200)
  async presignDownload(
    @Param('docId') docId: string,
    @Req() req: any,
    @Body() body: any,
  ) {
    const response = await this.proxyService.forward(req, {
      method: 'POST',
      url: `${process.env.DOCUMENT_SERVICE_URL}/documents/${docId}/presign-download`,
      data: body,
    });
    return response.data;
  }

  /**
   * Stream a specific file version directly.
   *
   * Authorization is checked by the policy service based on document status and ACL.
   */
  @Get(':docId/versions/:version/stream')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles('viewer', 'editor', 'approver', 'admin')
  @ApiOperation({
    summary: 'Stream file version',
    description:
      'Stream a specific version of the document file directly through the gateway. ' +
      'Used when MinIO is not directly accessible from the client.',
  })
  async streamVersion(
    @Param('docId') docId: string,
    @Param('version') version: string,
    @Req() req: any,
    @Res() res: Response,
  ) {
    const response = await this.proxyService.forward(req, {
      method: 'GET',
      url: `${process.env.DOCUMENT_SERVICE_URL}/documents/${docId}/versions/${version}/stream`,
      responseType: 'stream',
    });

    if (response.headers['content-type']) {
      res.setHeader('Content-Type', response.headers['content-type'] as string);
    }
    if (response.headers['content-disposition']) {
      res.setHeader(
        'Content-Disposition',
        response.headers['content-disposition'] as string,
      );
    }

    (response.data as NodeJS.ReadableStream).pipe(res);
  }
}
