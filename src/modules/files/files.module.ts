import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { FileRecord } from './entities/file-record.entity';
import { FilesService } from './files.service';
import { FilesController } from './files.controller';
import { UsersModule } from '../users/users.module';
import { CloudinaryStorageProvider } from './storage/cloudinary-storage.provider';
import { RESOURCE_STORAGE_PROVIDER } from './storage/resource-storage.provider';

@Module({
  imports: [TypeOrmModule.forFeature([FileRecord]), UsersModule],
  controllers: [FilesController],
  providers: [
    FilesService,
    CloudinaryStorageProvider,
    {
      provide: RESOURCE_STORAGE_PROVIDER,
      useFactory: (cloudinaryProvider: CloudinaryStorageProvider) => {
        const driver = (process.env.RESOURCE_STORAGE_DRIVER || 'cloudinary').toLowerCase();
        if (driver !== 'cloudinary') {
          throw new Error(`Unsupported RESOURCE_STORAGE_DRIVER="${driver}". Only "cloudinary" is currently available.`);
        }
        return cloudinaryProvider;
      },
      inject: [CloudinaryStorageProvider],
    },
  ],
  exports: [FilesService, RESOURCE_STORAGE_PROVIDER],
})
export class FilesModule {}
