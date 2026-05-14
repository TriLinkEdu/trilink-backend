import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { FileRecord } from './entities/file-record.entity';
import { FilesService } from './files.service';
import { FilesController } from './files.controller';
import { UsersModule } from '../users/users.module';
import { CloudinaryStorageProvider } from './storage/cloudinary-storage.provider';
import { LocalStorageProvider } from './storage/local-storage.provider';
import { S3StorageProvider } from './storage/s3-storage.provider';
import { RESOURCE_STORAGE_PROVIDER } from './storage/resource-storage.provider';

const resourceStorageProvider = {
  provide: RESOURCE_STORAGE_PROVIDER,
  inject: [CloudinaryStorageProvider, LocalStorageProvider, S3StorageProvider],
  useFactory: (
    cloudinary: CloudinaryStorageProvider,
    local: LocalStorageProvider,
    s3: S3StorageProvider,
  ) => {
    const driver = (process.env.RESOURCE_STORAGE_DRIVER || 'cloudinary').toLowerCase();
    if (driver === 'local') return local;
    if (driver === 's3') return s3;
    return cloudinary;
  },
};

@Module({
  imports: [TypeOrmModule.forFeature([FileRecord]), UsersModule],
  controllers: [FilesController],
  providers: [
    FilesService,
    CloudinaryStorageProvider,
    LocalStorageProvider,
    S3StorageProvider,
    resourceStorageProvider,
  ],
  exports: [FilesService, RESOURCE_STORAGE_PROVIDER],
})
export class FilesModule {}
