import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { FileRecord } from './entities/file-record.entity';
import { v2 as cloudinary } from 'cloudinary';
import * as streamifier from 'streamifier';

@Injectable()
export class FilesService {
  constructor(@InjectRepository(FileRecord) private readonly repo: Repository<FileRecord>) {
    cloudinary.config({
      cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
      api_key: process.env.CLOUDINARY_API_KEY,
      api_secret: process.env.CLOUDINARY_API_SECRET,
    });
  }

  async uploadFile(file: Express.Multer.File, uploadedById: string) {
    return new Promise<FileRecord>((resolve, reject) => {
      const uploadStream = cloudinary.uploader.upload_stream(
        { folder: 'trilink_uploads', resource_type: 'auto' },
        async (error, result) => {
          if (error) return reject(error);
          if (!result) return reject(new Error('Cloudinary returned no result'));
          
          const rec = this.repo.create({
            filename: file.originalname,
            mime: file.mimetype,
            path: result.secure_url,
            uploadedById,
          });
          resolve(await this.repo.save(rec));
        },
      );
      streamifier.createReadStream(file.buffer).pipe(uploadStream);
    });
  }

  async uploadFileRecord(body: {
    filename: string;
    mime: string;
    path: string;
    uploadedById: string;
    storageProvider?: string;
    storageKey?: string | null;
    version?: string | null;
    etag?: string | null;
    sizeBytes?: string | null;
  }) {
    return this.repo.save(
      this.repo.create({
        filename: body.filename,
        mime: body.mime,
        path: body.path,
        uploadedById: body.uploadedById,
        storageProvider: body.storageProvider ?? 'cloudinary',
        storageKey: body.storageKey ?? null,
        version: body.version ?? null,
        etag: body.etag ?? null,
        sizeBytes: body.sizeBytes ?? null,
      }),
    );
  }

  async get(id: string) {
    return this.repo.findOne({ where: { id } });
  }

  async getOrThrow(id: string) {
    const file = await this.get(id);
    if (!file) throw new NotFoundException('File not found');
    return file;
  }
}
