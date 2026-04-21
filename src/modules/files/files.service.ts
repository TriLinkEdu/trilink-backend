import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { FileRecord } from './entities/file-record.entity';
import {
  ResourceStorageProvider,
  RESOURCE_STORAGE_PROVIDER,
  StoredFileRef,
} from './storage/resource-storage.provider';

@Injectable()
export class FilesService {
  constructor(
    @InjectRepository(FileRecord) private readonly repo: Repository<FileRecord>,
    @Inject(RESOURCE_STORAGE_PROVIDER)
    private readonly storage: ResourceStorageProvider,
  ) {}

  async uploadFile(file: Express.Multer.File, uploadedById: string) {
    const stored = await this.storage.upload(file);
    const rec = this.repo.create({
      filename: file.originalname,
      mime: file.mimetype,
      path: stored.accessUrl,
      uploadedById,
      storageProvider: stored.storageProvider,
      storageKey: stored.storageKey,
      version: stored.version,
      etag: stored.etag,
      sizeBytes: stored.sizeBytes == null ? null : String(stored.sizeBytes),
    });
    return this.repo.save(rec);
  }

  async get(id: string) {
    return this.repo.findOne({ where: { id } });
  }

  async getOrThrow(id: string) {
    const file = await this.get(id);
    if (!file) throw new NotFoundException('File not found');
    return file;
  }

  async getAccessMetadata(id: string, options?: { expiresInSeconds?: number }) {
    const file = await this.getOrThrow(id);
    const expiresInSeconds =
      options?.expiresInSeconds == null
        ? 3600
        : Math.min(Math.max(options.expiresInSeconds, 60), 86400);

    const accessUrl = await this.storage.getAccessUrl(this.toStoredRef(file), {
      expiresInSeconds,
    });

    return {
      id: file.id,
      filename: file.filename,
      mime: file.mime,
      storageProvider: file.storageProvider,
      storageKey: file.storageKey,
      version: file.version,
      etag: file.etag,
      sizeBytes: file.sizeBytes == null ? null : Number(file.sizeBytes),
      accessUrl,
      cacheKey: `${file.id}:${file.version || file.etag || 'v1'}`,
      expiresInSeconds,
    };
  }

  private toStoredRef(file: FileRecord): StoredFileRef {
    return {
      id: file.id,
      filename: file.filename,
      mime: file.mime,
      path: file.path,
      storageProvider: file.storageProvider,
      storageKey: file.storageKey,
    };
  }
}
