import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { FileRecord } from './entities/file-record.entity';
import { FilesService } from './files.service';
import { FilesController } from './files.controller';
import { UsersModule } from '../users/users.module';
import { CloudinaryStorageProvider } from './storage/cloudinary-storage.provider';
import { S3StorageProvider } from './storage/s3-storage.provider';
import { RESOURCE_STORAGE_PROVIDER } from './storage/resource-storage.provider';

@Module({
  imports: [TypeOrmModule.forFeature([FileRecord]), UsersModule],
  controllers: [FilesController],
  providers: [
    FilesService,
    CloudinaryStorageProvider,
    S3StorageProvider,
    {
      provide: RESOURCE_STORAGE_PROVIDER,
      useFactory: (
        cloudinaryProvider: CloudinaryStorageProvider,
        s3Provider: S3StorageProvider,
      ) => {
        const driver = (process.env.RESOURCE_STORAGE_DRIVER || 'cloudinary').toLowerCase();
        if (driver === 's3') {
          return s3Provider;
        }
        return cloudinaryProvider;
      },
      inject: [CloudinaryStorageProvider, S3StorageProvider],
    },
  ],
  exports: [FilesService],
})
export class FilesModule {}
