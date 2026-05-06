import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { FileRecord } from './entities/file-record.entity';
import { FilesService } from './files.service';
import { FilesController } from './files.controller';
import { UsersModule } from '../users/users.module';
import { CloudinaryStorageProvider } from './storage/cloudinary-storage.provider';
import { S3StorageProvider } from './storage/s3-storage.provider';
import { LocalStorageProvider } from './storage/local-storage.provider';
import { RESOURCE_STORAGE_PROVIDER } from './storage/resource-storage.provider';

@Module({
  imports: [TypeOrmModule.forFeature([FileRecord]), UsersModule],
  controllers: [FilesController],
  providers: [
    FilesService,
    CloudinaryStorageProvider,
    S3StorageProvider,
    LocalStorageProvider,
    {
      provide: RESOURCE_STORAGE_PROVIDER,
      useFactory: (
        cloudinaryProvider: CloudinaryStorageProvider,
        s3Provider: S3StorageProvider,
        localProvider: LocalStorageProvider,
      ) => {
        const driver = (process.env.RESOURCE_STORAGE_DRIVER || 'cloudinary').toLowerCase();
        if (driver === 's3') return s3Provider;
        if (driver === 'local') return localProvider;
        if (driver !== 'cloudinary') throw new Error(`Unsupported RESOURCE_STORAGE_DRIVER="${driver}"`);
        const hasCloudinaryConfig = Boolean(
          process.env.CLOUDINARY_CLOUD_NAME &&
          process.env.CLOUDINARY_API_KEY &&
          process.env.CLOUDINARY_API_SECRET,
        );
        if (!hasCloudinaryConfig && process.env.NODE_ENV !== 'production') {
          return localProvider;
        }
        return cloudinaryProvider;
      },
      inject: [CloudinaryStorageProvider, S3StorageProvider, LocalStorageProvider],
    },
  ],
  exports: [FilesService, RESOURCE_STORAGE_PROVIDER],
})
export class FilesModule {}
