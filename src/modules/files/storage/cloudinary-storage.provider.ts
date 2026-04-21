import { Injectable } from '@nestjs/common';
import { v2 as cloudinary } from 'cloudinary';
import * as streamifier from 'streamifier';
import { ResourceStorageProvider, StoredFileRef, StoredObjectResult } from './resource-storage.provider';

@Injectable()
export class CloudinaryStorageProvider implements ResourceStorageProvider {
  readonly driver = 'cloudinary' as const;

  constructor() {
    cloudinary.config({
      cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
      api_key: process.env.CLOUDINARY_API_KEY,
      api_secret: process.env.CLOUDINARY_API_SECRET,
    });
  }

  async upload(file: Express.Multer.File, options?: { folder?: string }): Promise<StoredObjectResult> {
    const folder = options?.folder || process.env.RESOURCE_STORAGE_CLOUDINARY_FOLDER || 'trilink_uploads';
    return new Promise<StoredObjectResult>((resolve, reject) => {
      const uploadStream = cloudinary.uploader.upload_stream(
        { folder, resource_type: 'auto' },
        (error, result) => {
          if (error) return reject(error);
          if (!result) return reject(new Error('Cloudinary returned no result'));
          resolve({
            storageProvider: 'cloudinary',
            storageKey: result.public_id,
            accessUrl: result.secure_url,
            version: result.version ? String(result.version) : null,
            etag: result.etag || null,
            sizeBytes: typeof result.bytes === 'number' ? result.bytes : null,
            mimeType: file.mimetype,
          });
        },
      );
      streamifier.createReadStream(file.buffer).pipe(uploadStream);
    });
  }

  async getAccessUrl(file: StoredFileRef): Promise<string> {
    return file.path;
  }
}
