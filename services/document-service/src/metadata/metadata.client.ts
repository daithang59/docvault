import { HttpService } from '@nestjs/axios';
import { Injectable } from '@nestjs/common';
import { firstValueFrom } from 'rxjs';
import { RequestContext } from '../common/request-context';

@Injectable()
export class MetadataClient {
  private readonly baseUrl = process.env.METADATA_SERVICE_URL!;

  constructor(private readonly http: HttpService) {}

  async getDocument(docId: string, context: RequestContext) {
    const response = await firstValueFrom(
      this.http.get(`${this.baseUrl}/documents/${docId}`, {
        headers: this.buildHeaders(context),
      }),
    );
    return response.data;
  }

  async createVersion(docId: string, body: Record<string, unknown>, context: RequestContext) {
    const response = await firstValueFrom(
      this.http.post(`${this.baseUrl}/documents/${docId}/versions`, body, {
        headers: this.buildHeaders(context),
      }),
    );
    return response.data;
  }

  async authorizeDownload(
    docId: string,
    body: Record<string, unknown>,
    context: RequestContext,
  ) {
    const response = await firstValueFrom(
      this.http.post(
        `${this.baseUrl}/documents/${docId}/download-authorize`,
        body,
        {
          headers: this.buildHeaders(context),
        },
      ),
    );
    return response.data;
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
