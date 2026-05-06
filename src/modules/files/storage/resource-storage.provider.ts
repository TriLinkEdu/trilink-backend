export const RESOURCE_STORAGE_PROVIDER = 'RESOURCE_STORAGE_PROVIDER';

export type StorageDriver = 'cloudinary' | 's3';

export interface StoredObjectResult {
  storageProvider: StorageDriver;
  storageKey: string;
  accessUrl: string;
  version: string | null;
  etag: string | null;
  sizeBytes: number | null;
  mimeType: string;
}

export interface StoredFileRef {
  id: string;
  filename: string;
  mime: string;
  path: string;
  storageProvider: string;
  storageKey: string | null;
}

export interface ResourceStorageProvider {
  readonly driver: StorageDriver;
  upload(file: Express.Multer.File, options?: { folder?: string }): Promise<StoredObjectResult>;
  getAccessUrl(file: StoredFileRef, options?: { expiresInSeconds?: number }): Promise<string>;
}
