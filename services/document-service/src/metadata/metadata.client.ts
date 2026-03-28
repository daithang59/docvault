import { HttpService } from '@nestjs/axios';
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  HttpException,
  HttpStatus,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { AxiosError } from 'axios';
import { firstValueFrom } from 'rxjs';
import { RequestContext } from '../common/request-context';

@Injectable()
export class MetadataClient {
  private readonly baseUrl = process.env.METADATA_SERVICE_URL!;

  constructor(private readonly http: HttpService) {}

  async getDocument(docId: string, context: RequestContext) {
    return this.request(() =>
      firstValueFrom(
        this.http.get(`${this.baseUrl}/documents/${docId}`, {
          headers: this.buildHeaders(context),
        }),
      ),
    );
  }

  async createVersion(
    docId: string,
    body: Record<string, unknown>,
    context: RequestContext,
  ) {
    return this.request(() =>
      firstValueFrom(
        this.http.post(`${this.baseUrl}/documents/${docId}/versions`, body, {
          headers: this.buildHeaders(context),
        }),
      ),
    );
  }

  async authorizeDownload(
    docId: string,
    body: Record<string, unknown>,
    context: RequestContext,
  ) {
    return this.request(() =>
      firstValueFrom(
        this.http.post(
          `${this.baseUrl}/documents/${docId}/download-authorize`,
          body,
          {
            headers: this.buildHeaders(context),
          },
        ),
      ),
    );
  }

  async authorizePreview(
    docId: string,
    body: Record<string, unknown>,
    context: RequestContext,
  ) {
    return this.request(() =>
      firstValueFrom(
        this.http.post(
          `${this.baseUrl}/documents/${docId}/preview-authorize`,
          body,
          {
            headers: this.buildHeaders(context),
          },
        ),
      ),
    );
  }

  private async request<T>(execute: () => Promise<{ data: T }>): Promise<T> {
    try {
      const response = await execute();
      return response.data;
    } catch (error) {
      this.rethrowHttpError(error);
    }
  }

  private rethrowHttpError(error: unknown): never {
    const axiosError = error as AxiosError<any>;
    const status = axiosError.response?.status;
    const message =
      axiosError.response?.data?.message?.[0] ??
      axiosError.response?.data?.message ??
      (error as Error).message;

    switch (status) {
      case HttpStatus.BAD_REQUEST:
        throw new BadRequestException(message);
      case HttpStatus.FORBIDDEN:
        throw new ForbiddenException(message);
      case HttpStatus.NOT_FOUND:
        throw new NotFoundException(message);
      case HttpStatus.CONFLICT:
        throw new ConflictException(message);
      default:
        if (status) {
          throw new HttpException(message, status);
        }
        throw error;
    }
  }

  private buildHeaders(context: RequestContext) {
    return {
      authorization: context.authorization,
      'x-request-id': context.traceId,
      'x-user-id': context.actorId,
      'x-roles': context.roles.join(','),
    };
  }
}
