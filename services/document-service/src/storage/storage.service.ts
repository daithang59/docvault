import {
  DeleteObjectCommand,
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
  type S3ClientConfig,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { Injectable, NotFoundException } from '@nestjs/common';

@Injectable()
export class StorageService {
  private readonly bucket = process.env.S3_BUCKET!;
  /**
   * Internal endpoint used for SDK operations (server-to-server).
   * Set for MinIO/S3-compatible storage. Leave unset for native AWS S3.
   */
  private readonly endpoint = process.env.S3_ENDPOINT || undefined;
  /**
   * Public-facing URL used when generating presigned URLs.
   * Used only for MinIO/S3-compatible endpoints that are not reachable by
   * clients through the internal endpoint.
   */
  private readonly publicUrl = this.endpoint
    ? (process.env.S3_PUBLIC_URL ?? this.endpoint)
    : undefined;
  private readonly serverSideEncryption =
    process.env.S3_SERVER_SIDE_ENCRYPTION === 'aws:kms'
      ? ('aws:kms' as const)
      : undefined;
  private readonly kmsKeyId = process.env.S3_KMS_KEY_ID || undefined;
  private readonly bucketKeyEnabled =
    process.env.S3_BUCKET_KEY_ENABLED === 'true' ? true : undefined;
  private readonly staticCredentialsEnabled =
    process.env.S3_USE_STATIC_CREDENTIALS !== 'false';

  private readonly client = new S3Client(this.buildClientConfig());

  private buildClientConfig(): S3ClientConfig {
    const accessKeyId = process.env.S3_ACCESS_KEY;
    const secretAccessKey = process.env.S3_SECRET_KEY;
    const credentials =
      this.staticCredentialsEnabled && accessKeyId && secretAccessKey
        ? {
            accessKeyId,
            secretAccessKey,
          }
        : undefined;

    return {
      region: process.env.S3_REGION ?? 'us-east-1',
      ...(this.endpoint ? { endpoint: this.endpoint } : {}),
      forcePathStyle: process.env.S3_FORCE_PATH_STYLE === 'true',
      ...(credentials ? { credentials } : {}),
    };
  }

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
        ServerSideEncryption: this.serverSideEncryption,
        SSEKMSKeyId: this.kmsKeyId,
        BucketKeyEnabled: this.bucketKeyEnabled,
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
    if (this.endpoint && this.publicUrl && this.publicUrl !== this.endpoint) {
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
