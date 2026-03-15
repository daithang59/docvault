import { HttpService } from '@nestjs/axios';
import { HttpException, Injectable } from '@nestjs/common';
import { AxiosRequestConfig } from 'axios';
import { firstValueFrom } from 'rxjs';

@Injectable()
export class ProxyService {
  constructor(private readonly http: HttpService) {}

  async forward(
    req: any,
    config: AxiosRequestConfig & { url: string; responseType?: 'json' | 'stream' },
  ) {
    try {
      return await firstValueFrom(
        this.http.request({
          ...config,
          headers: {
            ...config.headers,
            authorization: req.headers.authorization,
            'x-request-id': req.traceId ?? req.headers['x-request-id'],
            'x-user-id': req.user?.username ?? req.user?.sub ?? '',
            'x-roles': (req.user?.roles ?? []).join(','),
          },
          maxBodyLength: Infinity,
        }),
      );
    } catch (error: any) {
      if (error.response) {
        let data = error.response.data;
        if (data && typeof data.pipe === 'function') {
          data = { message: ['Downstream proxy error (stream)'] };
        }
        throw new HttpException(data, error.response.status);
      }
      throw new HttpException(
        { message: ['Gateway proxy error'] },
        500,
      );
    }
  }
}
