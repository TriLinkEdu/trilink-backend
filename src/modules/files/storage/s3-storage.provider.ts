import { Injectable } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { extname } from 'path';
import {
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { ResourceStorageProvider, StoredFileRef, StoredObjectResult } from './resource-storage.provider';

@Injectable()
export class S3StorageProvider implements ResourceStorageProvider {
  readonly driver = 's3' as const;
  private client: S3Client | null = null;
  private bucket: string | null = null;
  private publicBaseUrl: string | null = null;

  private getConfig() {
    if (this.client && this.bucket !== null) {
      return { client: this.client, bucket: this.bucket, publicBaseUrl: this.publicBaseUrl };
    }
    this.bucket = requireEnv('RESOURCE_STORAGE_S3_BUCKET');
    this.publicBaseUrl = normalizeBaseUrl(process.env.RESOURCE_STORAGE_S3_PUBLIC_BASE_URL);
    this.client = new S3Client({
      region: process.env.RESOURCE_STORAGE_S3_REGION || process.env.AWS_REGION || 'us-east-1',
      endpoint: process.env.RESOURCE_STORAGE_S3_ENDPOINT || undefined,
      forcePathStyle: process.env.RESOURCE_STORAGE_S3_FORCE_PATH_STYLE === 'true',
      credentials:
        process.env.RESOURCE_STORAGE_S3_ACCESS_KEY_ID && process.env.RESOURCE_STORAGE_S3_SECRET_ACCESS_KEY
          ? {
              accessKeyId: process.env.RESOURCE_STORAGE_S3_ACCESS_KEY_ID,
              secretAccessKey: process.env.RESOURCE_STORAGE_S3_SECRET_ACCESS_KEY,
            }
          : undefined,
    });
    return { client: this.client, bucket: this.bucket, publicBaseUrl: this.publicBaseUrl };
  }

  async upload(file: Express.Multer.File, options?: { folder?: string }): Promise<StoredObjectResult> {
    const folder = sanitizePathSegment(options?.folder || process.env.RESOURCE_STORAGE_S3_PREFIX || 'trilink_uploads');
    const ext = extname(file.originalname || '').toLowerCase();
    const key = `${folder}/${new Date().toISOString().slice(0, 10)}/${randomUUID()}${ext}`;

    const { client, bucket } = this.getConfig();
    const result = await client.send(
      new PutObjectCommand({
        Bucket: bucket,
        Key: key,
        Body: file.buffer,
        ContentType: file.mimetype,
        ContentLength: file.size,
        Metadata: {
          originalName: file.originalname || 'upload',
        },
      }),
    );

    return {
      storageProvider: 's3',
      storageKey: key,
      accessUrl: await this.accessUrlForKey(key),
      version: result.VersionId ?? null,
      etag: result.ETag?.replace(/^"|"$/g, '') ?? null,
      sizeBytes: typeof file.size === 'number' ? file.size : null,
      mimeType: file.mimetype,
    };
  }

  async getAccessUrl(file: StoredFileRef, options?: { expiresInSeconds?: number }): Promise<string> {
    if (!file.storageKey) return file.path;
    return this.accessUrlForKey(file.storageKey, options?.expiresInSeconds);
  }

  private async accessUrlForKey(key: string, expiresInSeconds = 3600): Promise<string> {
    const { client, bucket, publicBaseUrl } = this.getConfig();
    if (publicBaseUrl) {
      return `${publicBaseUrl}/${encodeS3Key(key)}`;
    }
    return getSignedUrl(
      client,
      new GetObjectCommand({ Bucket: bucket, Key: key }),
      { expiresIn: Math.min(Math.max(expiresInSeconds, 60), 86400) },
    );
  }
}

function requireEnv(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} is required when RESOURCE_STORAGE_DRIVER=s3`);
  return value;
}

function normalizeBaseUrl(value: string | undefined): string | null {
  const trimmed = value?.trim();
  if (!trimmed) return null;
  return trimmed.replace(/\/+$/, '');
}

function sanitizePathSegment(value: string): string {
  return value
    .split('/')
    .map((part) => part.trim().replace(/[^a-zA-Z0-9._-]/g, '-'))
    .filter(Boolean)
    .join('/') || 'trilink_uploads';
}

function encodeS3Key(key: string): string {
  return key.split('/').map(encodeURIComponent).join('/');
}
