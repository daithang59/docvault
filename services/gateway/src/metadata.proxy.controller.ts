import {
  Body,
  Controller,
  Get,
  HttpException,
  Param,
  Patch,
  Post,
  Req,
  Res,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { catchError, firstValueFrom } from 'rxjs';
import { AuthGuard } from '@nestjs/passport';
import {
  ApiBearerAuth,
  ApiConsumes,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { Response } from 'express';
// eslint-disable-next-line @typescript-eslint/no-require-imports
const FormData = require('form-data') as typeof import('form-data');

@ApiTags('metadata-proxy')
@ApiBearerAuth()
@Controller('metadata')
export class MetadataProxyController {
  constructor(private readonly http: HttpService) {}

  private handleAxiosError(err: any): never {
    if (err.response) {
      throw new HttpException(err.response.data, err.response.status);
    }
    throw new HttpException('Gateway Error', 500);
  }

  @Get('documents')
  @UseGuards(AuthGuard('jwt'))
  @ApiOperation({ summary: 'Proxy → metadata-service GET /documents' })
  async list(@Req() req: any) {
    const response = await firstValueFrom(
      this.http.get('http://localhost:3001/documents', {
        headers: { authorization: req.headers.authorization },
      }).pipe(catchError((e) => this.handleAxiosError(e))),
    );
    return response.data;
  }

  @Post('documents')
  @UseGuards(AuthGuard('jwt'))
  @ApiOperation({ summary: 'Proxy → metadata-service POST /documents' })
  async create(@Req() req: any, @Body() body: any) {
    const response = await firstValueFrom(
      this.http.post('http://localhost:3001/documents', body, {
        headers: { authorization: req.headers.authorization },
      }).pipe(catchError((e) => this.handleAxiosError(e))),
    );
    return response.data;
  }

  @Post('documents/upload')
  @UseGuards(AuthGuard('jwt'))
  @ApiOperation({ summary: 'Proxy → metadata-service POST /documents/upload (multipart)' })
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      limits: { fileSize: 20 * 1024 * 1024 },
    }),
  )
  async upload(
    @Req() req: any,
    @UploadedFile() file: Express.Multer.File,
    @Body() body: any,
  ) {
    const form = new FormData();
    form.append('title', body.title ?? '');
    if (body.description) form.append('description', body.description);
    form.append('file', file.buffer, {
      filename: file.originalname,
      contentType: file.mimetype,
    });

    const response = await firstValueFrom(
      this.http.post('http://localhost:3001/documents/upload', form, {
        headers: {
          ...form.getHeaders(),
          authorization: req.headers.authorization,
        },
        maxBodyLength: Infinity,
      }).pipe(catchError((e) => this.handleAxiosError(e))),
    );
    return response.data;
  }

  @Get('documents/:id/download-url')
  @UseGuards(AuthGuard('jwt'))
  @ApiOperation({ summary: 'Proxy → metadata-service GET /documents/:id/download-url' })
  async getDownloadUrl(@Param('id') id: string, @Req() req: any) {
    const response = await firstValueFrom(
      this.http.get(`http://localhost:3001/documents/${id}/download-url`, {
        headers: { authorization: req.headers.authorization },
      }).pipe(catchError((e) => this.handleAxiosError(e))),
    );
    return response.data;
  }

  @Get('documents/:id/download')
  @UseGuards(AuthGuard('jwt'))
  @ApiOperation({ summary: 'Proxy → metadata-service GET /documents/:id/download (stream)' })
  async download(
    @Param('id') id: string,
    @Req() req: any,
    @Res() res: Response,
  ) {
    const response = await firstValueFrom(
      this.http.get(`http://localhost:3001/documents/${id}/download`, {
        headers: { authorization: req.headers.authorization },
        responseType: 'stream',
      }).pipe(catchError((e) => this.handleAxiosError(e))),
    );

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

  @Get('documents/:id/audit')
  @UseGuards(AuthGuard('jwt'))
  @ApiOperation({ summary: 'Proxy → metadata-service GET /documents/:id/audit' })
  async audit(@Param('id') id: string, @Req() req: any) {
    const response = await firstValueFrom(
      this.http.get(`http://localhost:3001/documents/${id}/audit`, {
        headers: { authorization: req.headers.authorization },
      }),
    );
    return response.data;
  }

  @Patch('documents/:id/submit')
  @UseGuards(AuthGuard('jwt'))
  @ApiOperation({ summary: 'Proxy → metadata-service PATCH /documents/:id/submit' })
  async submit(@Param('id') id: string, @Req() req: any) {
    const response = await firstValueFrom(
      this.http.patch(`http://localhost:3001/documents/${id}/submit`, null, {
        headers: { authorization: req.headers.authorization },
      }),
    );
    return response.data;
  }

  @Patch('documents/:id/approve')
  @UseGuards(AuthGuard('jwt'))
  @ApiOperation({ summary: 'Proxy → metadata-service PATCH /documents/:id/approve' })
  async approve(@Param('id') id: string, @Req() req: any) {
    const response = await firstValueFrom(
      this.http.patch(`http://localhost:3001/documents/${id}/approve`, null, {
        headers: { authorization: req.headers.authorization },
      }),
    );
    return response.data;
  }

  @Patch('documents/:id/reject')
  @UseGuards(AuthGuard('jwt'))
  @ApiOperation({ summary: 'Proxy → metadata-service PATCH /documents/:id/reject' })
  async reject(@Param('id') id: string, @Req() req: any, @Body() body: any) {
    const response = await firstValueFrom(
      this.http.patch(`http://localhost:3001/documents/${id}/reject`, body, {
        headers: { authorization: req.headers.authorization },
      }),
    );
    return response.data;
  }

  @Patch('documents/:id/archive')
  @UseGuards(AuthGuard('jwt'))
  @ApiOperation({ summary: 'Proxy → metadata-service PATCH /documents/:id/archive' })
  async archive(@Param('id') id: string, @Req() req: any) {
    const response = await firstValueFrom(
      this.http.patch(`http://localhost:3001/documents/${id}/archive`, null, {
        headers: { authorization: req.headers.authorization },
      }),
    );
    return response.data;
  }
}
