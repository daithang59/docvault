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
  /**
   * Internal endpoint used for SDK operations (server-to-server).
   * Default: http://localhost:9000
   */
  private readonly endpoint =
    process.env.S3_ENDPOINT ?? 'http://localhost:9000';
  /**
   * Public-facing URL used when generating presigned URLs.
   * Set this to your LAN IP or public domain when deploying.
   * Default: same as endpoint (works for localhost).
   */
  private readonly publicUrl = process.env.S3_PUBLIC_URL ?? this.endpoint;

  private readonly client = new S3Client({
    region: process.env.S3_REGION ?? 'us-east-1',
    endpoint: this.endpoint,
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

    const signedUrl = await getSignedUrl(this.client, command, {
      expiresIn: params.expiresInSeconds,
    });

    // Replace the internal endpoint with the public-facing URL
    // so the presigned URL works from remote clients (LAN / public).
    if (this.publicUrl !== this.endpoint) {
      return signedUrl.replace(this.endpoint, this.publicUrl);
    }

    return signedUrl;
  }

  async getObjectStream(
    objectKey: string,
    range?: { start: number; end: number },
  ) {
    if (!objectKey) {
      throw new NotFoundException('Object key not found');
    }

    return this.client.send(
      new GetObjectCommand({
        Bucket: this.bucket,
        Key: objectKey,
        Range: range ? `bytes=${range.start}-${range.end}` : undefined,
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
