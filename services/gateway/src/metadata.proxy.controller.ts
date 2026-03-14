import {
  Body,
  Controller,
  Get,
  Post,
  Req,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import { AuthGuard } from '@nestjs/passport';
import { ApiBearerAuth, ApiConsumes, ApiOperation, ApiTags } from '@nestjs/swagger';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
// eslint-disable-next-line @typescript-eslint/no-require-imports
const FormData = require('form-data') as typeof import('form-data');

@ApiTags('metadata-proxy')
@ApiBearerAuth()
@Controller('metadata')
export class MetadataProxyController {
  constructor(private readonly http: HttpService) {}

  @Get('documents')
  @UseGuards(AuthGuard('jwt'))
  @ApiOperation({ summary: 'Proxy → metadata-service GET /documents' })
  async list(@Req() req: any) {
    const response = await firstValueFrom(
      this.http.get('http://localhost:3001/documents', {
        headers: {
          authorization: req.headers.authorization,
        },
      }),
    );

    return response.data;
  }

  @Post('documents')
  @UseGuards(AuthGuard('jwt'))
  @ApiOperation({ summary: 'Proxy → metadata-service POST /documents' })
  async create(@Req() req: any, @Body() body: any) {
    const response = await firstValueFrom(
      this.http.post('http://localhost:3001/documents', body, {
        headers: {
          authorization: req.headers.authorization,
        },
      }),
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
      }),
    );

    return response.data;
  }
}

