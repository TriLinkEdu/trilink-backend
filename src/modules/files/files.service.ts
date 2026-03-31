import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { FileRecord } from './entities/file-record.entity';

@Injectable()
export class FilesService {
  constructor(@InjectRepository(FileRecord) private readonly repo: Repository<FileRecord>) {}

  async saveFromDisk(file: Express.Multer.File, uploadedById: string) {
    const rec = this.repo.create({
      filename: file.originalname,
      mime: file.mimetype,
      path: file.path,
      uploadedById,
    });
    return this.repo.save(rec);
  }

  async get(id: string) {
    return this.repo.findOne({ where: { id } });
  }
}
