import { HttpService } from '@nestjs/axios';
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  HttpException,
  HttpStatus,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { AxiosError } from 'axios';
import { firstValueFrom } from 'rxjs';
import { RequestContext } from '../common/request-context';

@Injectable()
export class MetadataClient {
  private readonly logger = new Logger(MetadataClient.name);
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

  /**
   * Calls metadata-service GET /documents/:docId/approvers.
   * The endpoint ignores the docId (approver role is global), but the path
   * param is required by REST convention. Pass any valid UUID.
   * Gracefully degrades to an empty list if the call fails.
   */
  async getApprovers(context: RequestContext): Promise<{ userIds: string[] }> {
    try {
      return await this.request(() =>
        firstValueFrom(
          this.http.get(`${this.baseUrl}/documents/00000000-0000-0000-0000-000000000000/approvers`, {
            headers: this.buildHeaders(context),
          }),
        ),
      );
    } catch {
      this.logger.warn('getApprovers() failed; returning empty list');
      return { userIds: [] };
    }
  }

  async updateStatus(
    docId: string,
    status: 'PENDING' | 'PUBLISHED' | 'DRAFT' | 'ARCHIVED' | 'DELETED',
    action: string,
    context: RequestContext,
    reason?: string,
  ) {
    return this.request(() =>
      firstValueFrom(
        this.http.post(
          `${this.baseUrl}/documents/${docId}/status`,
          { status, action, reason },
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
