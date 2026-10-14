import { Readable } from 'node:stream';
import {
  CopyObjectCommand,
  CreateBucketCommand,
  DeleteObjectCommand,
  GetObjectCommand,
  HeadBucketCommand,
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
  S3ServiceException,
} from '@aws-sdk/client-s3';
import { Upload } from '@aws-sdk/lib-storage';
import { Injectable, Logger, type OnModuleDestroy, type OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Env } from '../../config/env.js';

export interface PutObjectInput {
  key: string;
  body: Buffer | Readable;
  contentType?: string;
  /** Required by S3 when the body is a stream. */
  contentLength?: number;
  metadata?: Record<string, string>;
}

export interface ObjectInfo {
  key: string;
  size: number;
  contentType?: string;
  etag?: string;
  lastModified?: Date;
  metadata?: Record<string, string>;
}

/**
 * File storage on SeaweedFS through its S3 API. The bucket is private; the API streams downloads.
 * Keys are never overwritten by callers (documents get a new key per version).
 */
@Injectable()
export class StorageService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(StorageService.name);
  private readonly client: S3Client;
  readonly bucket: string;

  constructor(config: ConfigService<Env, true>) {
    this.bucket = config.get('S3_BUCKET', { infer: true });
    this.client = new S3Client({
      endpoint: config.get('S3_ENDPOINT', { infer: true }),
      region: config.get('S3_REGION', { infer: true }),
      forcePathStyle: true,
      credentials: {
        accessKeyId: config.get('S3_ACCESS_KEY', { infer: true }),
        secretAccessKey: config.get('S3_SECRET_KEY', { infer: true }),
      },
      // SeaweedFS does not need the newer default CRC32 checksums on every request.
      requestChecksumCalculation: 'WHEN_REQUIRED',
      responseChecksumValidation: 'WHEN_REQUIRED',
    });
  }

  async onModuleInit(): Promise<void> {
    // Retry for a while: SeaweedFS may still be starting up.
    for (let attempt = 1; attempt <= 10; attempt++) {
      try {
        await this.ensureBucket();
        return;
      } catch (err) {
        if (attempt === 10) {
          this.logger.error(`Storage is not reachable; uploads will fail: ${String(err)}`);
          return;
        }
        await new Promise((r) => setTimeout(r, 1000 * attempt));
      }
    }
  }

  onModuleDestroy(): void {
    this.client.destroy();
  }

  /** Creates the bucket if it does not exist yet. */
  async ensureBucket(): Promise<void> {
    try {
      await this.client.send(new HeadBucketCommand({ Bucket: this.bucket }));
    } catch (err) {
      if (!isNotFound(err)) throw err;
      this.logger.log(`Creating bucket ${this.bucket}`);
      await this.client.send(new CreateBucketCommand({ Bucket: this.bucket }));
    }
  }

  async putObject(input: PutObjectInput): Promise<{ etag?: string }> {
    const result = await this.client.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: input.key,
        Body: input.body,
        ContentType: input.contentType ?? 'application/octet-stream',
        ContentLength:
          input.contentLength ?? (Buffer.isBuffer(input.body) ? input.body.length : undefined),
        Metadata: input.metadata,
      }),
    );
    return { etag: result.ETag };
  }

  /**
   * Streams a body of unknown length to S3 (multipart upload in 5 MB parts, so big files are
   * never held in memory). Aborting `signal` cancels the upload.
   */
  async uploadStream(input: {
    key: string;
    body: Readable;
    contentType: string;
    metadata?: Record<string, string>;
    signal?: AbortSignal;
  }): Promise<void> {
    const upload = new Upload({
      client: this.client,
      params: {
        Bucket: this.bucket,
        Key: input.key,
        Body: input.body,
        ContentType: input.contentType,
        Metadata: input.metadata,
      },
      queueSize: 2,
      partSize: 5 * 1024 * 1024,
      leavePartsOnError: false,
    });
    const onAbort = () => void upload.abort().catch(() => undefined);
    input.signal?.addEventListener('abort', onAbort, { once: true });
    try {
      await upload.done();
    } finally {
      input.signal?.removeEventListener('abort', onAbort);
    }
  }

  /** Server-side copy to a new key (used to restore an old document version). */
  async copyObject(sourceKey: string, targetKey: string): Promise<void> {
    await this.client.send(
      new CopyObjectCommand({
        Bucket: this.bucket,
        Key: targetKey,
        CopySource: `${this.bucket}/${sourceKey.split('/').map(encodeURIComponent).join('/')}`,
      }),
    );
  }

  async getObjectStream(key: string): Promise<{ stream: Readable; info: ObjectInfo }> {
    const result = await this.client.send(new GetObjectCommand({ Bucket: this.bucket, Key: key }));
    if (!result.Body) throw new Error(`Empty body for ${key}`);
    return {
      stream: result.Body as Readable,
      info: {
        key,
        size: Number(result.ContentLength ?? 0),
        contentType: result.ContentType,
        etag: result.ETag,
        lastModified: result.LastModified,
        metadata: result.Metadata,
      },
    };
  }

  /** Returns object info, or null when the key does not exist. */
  async headObject(key: string): Promise<ObjectInfo | null> {
    try {
      const r = await this.client.send(new HeadObjectCommand({ Bucket: this.bucket, Key: key }));
      return {
        key,
        size: Number(r.ContentLength ?? 0),
        contentType: r.ContentType,
        etag: r.ETag,
        lastModified: r.LastModified,
        metadata: r.Metadata,
      };
    } catch (err) {
      if (isNotFound(err)) return null;
      throw err;
    }
  }

  async deleteObject(key: string): Promise<void> {
    await this.client.send(new DeleteObjectCommand({ Bucket: this.bucket, Key: key }));
  }

  /** Cheap connectivity check used by /health. */
  async ping(): Promise<void> {
    await this.client.send(new HeadBucketCommand({ Bucket: this.bucket }));
  }
}

function isNotFound(err: unknown): boolean {
  if (err instanceof S3ServiceException) {
    return (
      err.$metadata.httpStatusCode === 404 || err.name === 'NotFound' || err.name === 'NoSuchKey'
    );
  }
  const e = err as { name?: string; $metadata?: { httpStatusCode?: number } } | undefined;
  return (
    e?.$metadata?.httpStatusCode === 404 || e?.name === 'NotFound' || e?.name === 'NoSuchBucket'
  );
}
