import { Injectable, NotFoundException } from '@nestjs/common';
import {
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { randomUUID } from 'crypto';

@Injectable()
export class StorageService {
  private readonly bucket = process.env.S3_BUCKET!;
  private readonly client = new S3Client({
    region: process.env.S3_REGION ?? 'us-east-1',
    endpoint: process.env.S3_ENDPOINT,
    forcePathStyle: process.env.S3_FORCE_PATH_STYLE === 'true',
    credentials: {
      accessKeyId: process.env.S3_ACCESS_KEY!,
      secretAccessKey: process.env.S3_SECRET_KEY!,
    },
  });

  buildObjectKey(filename: string): string {
    const safe = filename.replace(/\s+/g, '-');
    return `documents/${new Date().toISOString().slice(0, 10)}/${randomUUID()}-${safe}`;
  }

  async upload(params: {
    objectKey: string;
    body: Buffer;
    contentType?: string;
    metadata?: Record<string, string>;
  }): Promise<{ bucket: string; objectKey: string; etag: string | undefined }> {
    const result = await this.client.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: params.objectKey,
        Body: params.body,
        ContentType: params.contentType,
        Metadata: params.metadata,
      }),
    );

    return {
      bucket: this.bucket,
      objectKey: params.objectKey,
      etag: result.ETag,
    };
  }

  async createDownloadUrl(params: {
    objectKey?: string | null;
    filename?: string | null;
    expiresInSeconds?: number;
  }): Promise<string> {
    if (!params.objectKey) {
      throw new NotFoundException('Object key not found');
    }

    const command = new GetObjectCommand({
      Bucket: this.bucket,
      Key: params.objectKey,
      ResponseContentDisposition: params.filename
        ? `attachment; filename="${encodeURIComponent(params.filename)}"`
        : undefined,
    });

    return getSignedUrl(this.client, command, {
      expiresIn: params.expiresInSeconds ?? 300,
    });
  }

  async getObjectStream(objectKey: string) {
    return this.client.send(
      new GetObjectCommand({
        Bucket: this.bucket,
        Key: objectKey,
      }),
    );
  }
}

