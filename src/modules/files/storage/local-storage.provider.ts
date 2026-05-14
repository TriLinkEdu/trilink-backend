import { Injectable } from '@nestjs/common';
import * as crypto from 'crypto';
import * as fs from 'fs/promises';
import * as path from 'path';
import {
  ResourceStorageProvider,
  StoredFileRef,
  StoredObjectResult,
} from './resource-storage.provider';

@Injectable()
export class LocalStorageProvider implements ResourceStorageProvider {
  readonly driver = 'local' as const;

  async upload(file: Express.Multer.File, options?: { folder?: string }): Promise<StoredObjectResult> {
    const root = localUploadsRoot();
    const folder = sanitizePath(options?.folder || process.env.RESOURCE_STORAGE_LOCAL_PREFIX || 'trilink_uploads');
    const ext = path.extname(file.originalname || '').toLowerCase();
    const base = sanitizeFilename(path.basename(file.originalname || 'upload', ext));
    const filename = `${Date.now()}-${crypto.randomUUID()}-${base}${ext || fallbackExtension(file.mimetype)}`;
    const relativeKey = path.posix.join(folder, filename);
    const absolutePath = path.join(root, ...relativeKey.split('/'));

    await fs.mkdir(path.dirname(absolutePath), { recursive: true });
    await fs.writeFile(absolutePath, file.buffer);

    return {
      storageProvider: 'local',
      storageKey: relativeKey,
      accessUrl: `${localPublicBaseUrl()}/uploads/${relativeKey}`,
      version: null,
      etag: crypto.createHash('sha1').update(file.buffer).digest('hex'),
      sizeBytes: file.size ?? file.buffer.length,
      mimeType: file.mimetype,
    };
  }

  async getAccessUrl(file: StoredFileRef): Promise<string> {
    if (file.path) return file.path;
    return `${localPublicBaseUrl()}/uploads/${file.storageKey}`;
  }
}

export function localUploadsRoot() {
  return path.resolve(process.env.RESOURCE_STORAGE_LOCAL_DIR || path.join(process.cwd(), 'uploads'));
}

function localPublicBaseUrl() {
  const explicit = process.env.RESOURCE_STORAGE_LOCAL_PUBLIC_BASE_URL || process.env.API_PUBLIC_BASE_URL;
  if (explicit) return explicit.replace(/\/$/, '');
  return `http://localhost:${process.env.PORT || 4000}`;
}

function sanitizePath(input: string) {
  return input
    .split(/[\\/]+/)
    .map(sanitizeFilename)
    .filter(Boolean)
    .join('/') || 'trilink_uploads';
}

function sanitizeFilename(input: string) {
  return input
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80) || 'file';
}

function fallbackExtension(mime: string) {
  if (mime === 'application/pdf') return '.pdf';
  if (mime === 'text/plain') return '.txt';
  if (mime === 'image/png') return '.png';
  if (mime === 'image/jpeg') return '.jpg';
  return '';
}
