import {
  DeleteObjectCommand,
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { Injectable, NotFoundException } from '@nestjs/common';

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

  buildObjectKey(docId: string, version: number, filename: string) {
    const safeFilename = filename.replace(/[^a-zA-Z0-9._-]/g, '-');
    return `doc/${docId}/v${version}/${safeFilename}`;
  }

  async upload(params: {
    objectKey: string;
    body: Buffer;
    contentType?: string;
    metadata?: Record<string, string>;
  }) {
    await this.client.send(
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
    };
  }

  async createDownloadUrl(params: {
    objectKey: string;
    filename: string;
    expiresInSeconds: number;
  }) {
    const command = new GetObjectCommand({
      Bucket: this.bucket,
      Key: params.objectKey,
      ResponseContentDisposition: `attachment; filename="${encodeURIComponent(
        params.filename,
      )}"`,
    });

    return getSignedUrl(this.client, command, {
      expiresIn: params.expiresInSeconds,
    });
  }

  async getObjectStream(objectKey: string) {
    if (!objectKey) {
      throw new NotFoundException('Object key not found');
    }

    return this.client.send(
      new GetObjectCommand({
        Bucket: this.bucket,
        Key: objectKey,
      }),
    );
  }

  /** Delete an object — used for rollback when version creation fails. */
  async deleteObject(objectKey: string) {
    await this.client.send(
      new DeleteObjectCommand({
        Bucket: this.bucket,
        Key: objectKey,
      }),
    );
  }
}
