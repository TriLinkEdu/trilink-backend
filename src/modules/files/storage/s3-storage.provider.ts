import { Injectable, NotImplementedException } from '@nestjs/common';
import { ResourceStorageProvider, StoredFileRef, StoredObjectResult } from './resource-storage.provider';

@Injectable()
export class S3StorageProvider implements ResourceStorageProvider {
  readonly driver = 's3' as const;

  async upload(_file: Express.Multer.File, _options?: { folder?: string }): Promise<StoredObjectResult> {
    throw new NotImplementedException('S3 provider is not configured yet');
  }

  async getAccessUrl(_file: StoredFileRef, _options?: { expiresInSeconds?: number }): Promise<string> {
    throw new NotImplementedException('S3 provider is not configured yet');
  }
}
