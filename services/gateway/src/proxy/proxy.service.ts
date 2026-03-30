import { HttpService } from '@nestjs/axios';
import { HttpException, Injectable } from '@nestjs/common';
import { AxiosRequestConfig } from 'axios';
import { firstValueFrom } from 'rxjs';

function parseCookies(raw: string): Record<string, string> {
  return Object.fromEntries(
    raw
      .split(';')
      .map((c) => c.trim())
      .filter(Boolean)
      .map((c) => {
        const [k, ...v] = c.split('=');
        return [k, decodeURIComponent(v.join('='))];
      }),
  );
}

function buildAuthorizationHeader(req: any): string | undefined {
  if (req.headers.authorization) {
    return req.headers.authorization;
  }

  // Fallback: when browser uses cookie-auth (dv_access_token),
  // gateway can authenticate but downstream services still need Bearer header.
  const rawCookies = req.headers.cookie ?? '';
  const cookies = parseCookies(rawCookies);
  const token = cookies['dv_access_token'];
  return token ? `Bearer ${token}` : undefined;
}

@Injectable()
export class ProxyService {
  constructor(private readonly http: HttpService) {}

  async forward(
    req: any,
    config: AxiosRequestConfig & {
      url: string;
      responseType?: 'json' | 'stream';
    },
  ) {
    try {
      return await firstValueFrom(
        this.http.request({
          ...config,
          headers: {
            ...config.headers,
            Authorization: buildAuthorizationHeader(req),
            'x-request-id': req.traceId ?? req.headers['x-request-id'],
            'x-user-id': req.user?.sub ?? req.user?.username ?? '',
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
      throw new HttpException({ message: ['Gateway proxy error'] }, 500);
    }
  }
}
