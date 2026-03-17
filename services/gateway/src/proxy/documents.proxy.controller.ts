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
} from '@nestjs/swagger';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { ProxyService } from './proxy.service';
// eslint-disable-next-line @typescript-eslint/no-require-imports
const FormData = require('form-data') as typeof import('form-data');

@ApiTags('documents-proxy')
@ApiBearerAuth()
@Controller('documents')
export class DocumentsProxyController {
  constructor(private readonly proxyService: ProxyService) {}

  @Post(':docId/upload')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles('editor', 'admin')
  @ApiOperation({
    summary: 'Proxy -> document-service POST /documents/:docId/upload',
  })
  @ApiConsumes('multipart/form-data')
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

  @Post(':docId/presign-download')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles('viewer', 'editor', 'approver', 'compliance_officer', 'admin')
  @ApiOperation({
    summary:
      'Proxy -> document-service POST /documents/:docId/presign-download',
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

  @Get(':docId/versions/:version/stream')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles('viewer', 'editor', 'approver', 'compliance_officer', 'admin')
  @ApiOperation({
    summary:
      'Proxy -> document-service GET /documents/:docId/versions/:version/stream',
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
