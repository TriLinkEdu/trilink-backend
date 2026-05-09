import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Textbook } from './entities/textbook.entity';
import { FilesService } from '../files/files.service';
import { CreateTextbookDto } from './dto/create-textbook.dto';
import { TextbookResponseDto } from './dto/textbook-response.dto';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { Logger } from '@nestjs/common';
import {
  Inject,
} from '@nestjs/common';
import {
  ResourceStorageProvider,
  RESOURCE_STORAGE_PROVIDER,
} from '../files/storage/resource-storage.provider';

@Injectable()
export class TextbooksService {
  private readonly logger = new Logger(TextbooksService.name);

  constructor(
    @InjectRepository(Textbook) private readonly repo: Repository<Textbook>,
    private readonly filesService: FilesService,
    @Inject(RESOURCE_STORAGE_PROVIDER)
    private readonly storage: ResourceStorageProvider,
    private readonly http: HttpService,
    private readonly config: ConfigService,
  ) {}

  /* ── Upload ─────────────────────────────────────────────── */

  async uploadTextbook(
    file: Express.Multer.File,
    dto: CreateTextbookDto,
    uploadedById: string,
    coverFile?: Express.Multer.File,
  ): Promise<TextbookResponseDto> {
    if (!file.mimetype.includes('pdf')) {
      throw new BadRequestException('Only PDF files are accepted for textbooks');
    }

    // Upload PDF to Cloudinary under textbooks/{subject}/{grade-X}
    const folder = `trilink_uploads/textbooks/${dto.subject.toLowerCase()}`;
    const pdfStored = await this.storage.upload(file, { folder });

    // Save file record in DB
    const fileRec = await this.filesService.uploadFileRecord({
      filename: file.originalname,
      mime: file.mimetype,
      path: pdfStored.accessUrl,
      uploadedById,
      storageProvider: pdfStored.storageProvider,
      storageKey: pdfStored.storageKey,
      version: pdfStored.version,
      etag: pdfStored.etag,
      sizeBytes: pdfStored.sizeBytes == null ? null : String(pdfStored.sizeBytes),
    });

    // Optional cover image upload
    let coverRec = null;
    if (coverFile) {
      const coverFolder = `trilink_uploads/textbooks/${dto.subject.toLowerCase()}/covers`;
      const coverStored = await this.storage.upload(coverFile, { folder: coverFolder });
      coverRec = await this.filesService.uploadFileRecord({
        filename: coverFile.originalname,
        mime: coverFile.mimetype,
        path: coverStored.accessUrl,
        uploadedById,
        storageProvider: coverStored.storageProvider,
        storageKey: coverStored.storageKey,
        version: coverStored.version,
        etag: coverStored.etag,
        sizeBytes: coverStored.sizeBytes == null ? null : String(coverStored.sizeBytes),
      });
    }

    // Create textbook record
    const textbook = this.repo.create({
      title: dto.title,
      subject: dto.subject,
      grade: dto.grade,
      description: dto.description || null,
      sizeBytes: pdfStored.sizeBytes == null ? null : String(pdfStored.sizeBytes),
      fileRecordId: fileRec.id,
      coverImageFileId: coverRec?.id || null,
    });

    const saved = await this.repo.save(textbook);
    
    // Trigger asynchronous textbook ingestion on the AI Engine
    const aiBase = this.config.get<string>('aiEngineUrl') || 'http://localhost:4001';
    const aiKey = this.config.get<string>('aiEngineApiKey') || '';
    
    this.http.post(
      `${aiBase}/api/ai/ingestion/trigger`,
      {
        pdf_url: pdfStored.accessUrl,
        subject: dto.subject,
        grade: dto.grade,
      },
      { headers: { 'x-api-key': aiKey } }
    ).subscribe({
      next: () => this.logger.log(`Triggered AI ingestion for ${dto.subject} Grade ${dto.grade}`),
      error: (err: Error) => this.logger.error(`Failed to trigger AI ingestion for ${dto.subject} Grade ${dto.grade}`, err.message),
    });

    return this.toDto(saved);
  }

  /* ── List ───────────────────────────────────────────────── */

  async findAll(filters?: { subject?: string; grade?: number }): Promise<TextbookResponseDto[]> {
    const qb = this.repo.createQueryBuilder('t')
      .leftJoinAndSelect('t.fileRecord', 'fr')
      .leftJoinAndSelect('t.coverImageFile', 'ci')
      .where('t.isActive = :active', { active: true });

    if (filters?.subject) {
      qb.andWhere('LOWER(t.subject) = LOWER(:subject)', { subject: filters.subject });
    }
    if (filters?.grade) {
      qb.andWhere('t.grade = :grade', { grade: filters.grade });
    }

    qb.orderBy('t.subject', 'ASC').addOrderBy('t.grade', 'ASC');

    const textbooks = await qb.getMany();
    return textbooks.map((t) => this.toDto(t));
  }

  /* ── Single ─────────────────────────────────────────────── */

  async findOne(id: string): Promise<TextbookResponseDto> {
    const textbook = await this.repo.findOne({
      where: { id, isActive: true },
      relations: ['fileRecord', 'coverImageFile'],
    });
    if (!textbook) throw new NotFoundException('Textbook not found');
    return this.toDto(textbook);
  }

  /* ── Delete (soft) ──────────────────────────────────────── */

  async remove(id: string): Promise<void> {
    const textbook = await this.repo.findOne({ where: { id } });
    if (!textbook) throw new NotFoundException('Textbook not found');
    textbook.isActive = false;
    await this.repo.save(textbook);
  }

  /* ── Helpers ────────────────────────────────────────────── */

  private toDto(t: Textbook): TextbookResponseDto {
    return {
      id: t.id,
      title: t.title,
      subject: t.subject,
      grade: t.grade,
      description: t.description,
      pageCount: t.pageCount,
      sizeBytes: t.sizeBytes == null ? null : Number(t.sizeBytes),
      isActive: t.isActive,
      fileRecordId: t.fileRecordId,
      fileVersion: t.fileRecord?.version || null,
      fileEtag: t.fileRecord?.etag || null,
      cacheKey: `${t.fileRecordId}:${t.fileRecord?.version || t.fileRecord?.etag || 'v1'}`,
      accessUrl: t.fileRecord?.path || '',
      coverUrl: t.coverImageFile?.path || null,
      createdAt: t.createdAt?.toISOString() || new Date().toISOString(),
    };
  }
}
