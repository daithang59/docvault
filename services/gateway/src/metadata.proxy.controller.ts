import { Controller, Get, Post, Req, Body, UseGuards } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import { AuthGuard } from '@nestjs/passport';
import { ApiOperation, ApiTags, ApiBearerAuth } from '@nestjs/swagger';

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
}
