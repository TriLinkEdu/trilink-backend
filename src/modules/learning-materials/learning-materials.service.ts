import { Injectable, NotFoundException, BadRequestException, Inject } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { LearningMaterial, MaterialType } from './entities/learning-material.entity';
import { FilesService } from '../files/files.service';
import { Enrollment } from '../enrollments/entities/enrollment.entity';
import { CreateLearningMaterialDto } from './dto/create-learning-material.dto';
import { LearningMaterialResponseDto } from './dto/learning-material-response.dto';
import {
  ResourceStorageProvider,
  RESOURCE_STORAGE_PROVIDER,
} from '../files/storage/resource-storage.provider';

@Injectable()
export class LearningMaterialsService {
  constructor(
    @InjectRepository(LearningMaterial)
    private readonly repo: Repository<LearningMaterial>,
    @InjectRepository(Enrollment)
    private readonly enrollmentRepo: Repository<Enrollment>,
    private readonly filesService: FilesService,
    @Inject(RESOURCE_STORAGE_PROVIDER)
    private readonly storage: ResourceStorageProvider,
  ) {}

  async uploadMaterial(
    dto: CreateLearningMaterialDto,
    uploadedById: string,
    file?: Express.Multer.File,
  ): Promise<LearningMaterialResponseDto> {
    let url: string;

    if (dto.type === MaterialType.LINK) {
      if (!dto.link) {
        throw new BadRequestException('Link URL is required for link type');
      }
      url = dto.link;
    } else {
      if (!file) {
        throw new BadRequestException('File is required for PDF/TXT type');
      }
      const allowedMimes = dto.type === MaterialType.PDF 
        ? ['application/pdf'] 
        : ['text/plain'];
      
      if (!allowedMimes.includes(file.mimetype)) {
        throw new BadRequestException(`Invalid file type. Expected ${dto.type}`);
      }

      const folder = `trilink_uploads/learning_materials/${dto.subject.toLowerCase()}`;
      const stored = await this.storage.upload(file, { folder });
      
      const fileRec = await this.filesService.uploadFileRecord({
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
      
      url = fileRec.path;
    }

    const material = this.repo.create({
      title: dto.title,
      type: dto.type,
      url,
      subject: dto.subject,
      grade: dto.grade,
      description: dto.description || null,
      topicId: dto.topicId || null,
      uploadedById,
      classOfferingId: dto.classOfferingId,
    });

    const saved = await this.repo.save(material);
    return this.toDto(saved);
  }

  async fetchByStudentEnrollment(studentId: string): Promise<LearningMaterialResponseDto[]> {
    const enrollments = await this.enrollmentRepo.find({
      where: { studentId },
      select: ['classOfferingId'],
    });

    if (enrollments.length === 0) {
      return [];
    }

    const classOfferingIds = enrollments.map((e) => e.classOfferingId);

    const materials = await this.repo
      .createQueryBuilder('m')
      .where('m.class_offering_id IN (:...ids)', { ids: classOfferingIds })
      .orderBy('m.created_at', 'DESC')
      .getMany();

    return materials.map((m) => this.toDto(m));
  }

  async fetchById(id: string): Promise<LearningMaterialResponseDto> {
    const material = await this.repo.findOne({ where: { id } });
    if (!material) {
      throw new NotFoundException('Learning material not found');
    }
    return this.toDto(material);
  }

  private toDto(m: LearningMaterial): LearningMaterialResponseDto {
    return {
      id: m.id,
      title: m.title,
      type: m.type,
      url: m.url,
      subject: m.subject,
      grade: m.grade,
      description: m.description,
      topicId: m.topicId,
      uploadedById: m.uploadedById,
      classOfferingId: m.classOfferingId,
      createdAt: m.createdAt.toISOString(),
    };
  }
}
