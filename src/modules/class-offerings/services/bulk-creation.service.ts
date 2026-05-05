import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { ClassOffering } from '../entities/class-offering.entity';
import { User, UserRole } from '../../users/entities/user.entity';
import { Grade } from '../../school-structure/entities/grade.entity';
import { Section } from '../../school-structure/entities/section.entity';
import { Subject } from '../../school-structure/entities/subject.entity';

export interface BulkCreationRequest {
  academicYearId: string;
  gradeId: string;
  sectionIds: string[];
  subjectIds: string[];
  teacherId: string;
}

export interface BulkCreationResult {
  created: Array<{
    classOfferingId: string;
    gradeId: string;
    sectionId: string;
    subjectId: string;
  }>;
  skipped: Array<{
    gradeId: string;
    sectionId: string;
    subjectId: string;
    reason: string;
  }>;
  summary: {
    totalRequested: number;
    successCount: number;
    skippedCount: number;
  };
}

@Injectable()
export class BulkClassOfferingService {
  private readonly logger = new Logger(BulkClassOfferingService.name);

  constructor(
    @InjectRepository(ClassOffering)
    private readonly offeringRepo: Repository<ClassOffering>,
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    @InjectRepository(Grade)
    private readonly gradeRepo: Repository<Grade>,
    @InjectRepository(Section)
    private readonly sectionRepo: Repository<Section>,
    @InjectRepository(Subject)
    private readonly subjectRepo: Repository<Subject>,
    private readonly dataSource: DataSource,
  ) {}

  /**
   * Create multiple class offerings in a single transaction
   * Skips duplicates and continues on validation errors
   */
  async bulkCreate(request: BulkCreationRequest): Promise<BulkCreationResult> {
    const { academicYearId, gradeId, sectionIds, subjectIds, teacherId } = request;

    // Validate teacher exists and has TEACHER role
    const teacher = await this.userRepo.findOne({ where: { id: teacherId } });
    if (!teacher || teacher.role !== UserRole.TEACHER) {
      throw new BadRequestException('teacherId must be a valid teacher user');
    }

    // Validate grade exists
    const grade = await this.gradeRepo.findOne({ where: { id: gradeId } });
    if (!grade) {
      throw new BadRequestException(`Grade with ID ${gradeId} not found`);
    }

    // Validate sections exist
    if (!sectionIds || sectionIds.length === 0) {
      throw new BadRequestException('At least one section must be provided');
    }

    // Validate subjects exist
    if (!subjectIds || subjectIds.length === 0) {
      throw new BadRequestException('At least one subject must be provided');
    }

    const created: BulkCreationResult['created'] = [];
    const skipped: BulkCreationResult['skipped'] = [];

    // Calculate total combinations
    const totalRequested = sectionIds.length * subjectIds.length;

    // Use transaction to ensure atomicity
    await this.dataSource.transaction(async (entityManager) => {
      const offeringRepo = entityManager.getRepository(ClassOffering);
      const sectionRepo = entityManager.getRepository(Section);
      const subjectRepo = entityManager.getRepository(Subject);

      // Fetch all sections and subjects in batch
      const [sections, subjects] = await Promise.all([
        sectionRepo.findByIds(sectionIds),
        subjectRepo.findByIds(subjectIds),
      ]);

      // Create maps for quick lookup
      const sectionMap = new Map(sections.map((s) => [s.id, s]));
      const subjectMap = new Map(subjects.map((s) => [s.id, s]));

      // Iterate through all combinations
      for (const sectionId of sectionIds) {
        for (const subjectId of subjectIds) {
          const section = sectionMap.get(sectionId);
          const subject = subjectMap.get(subjectId);

          // Skip if section or subject not found
          if (!section) {
            skipped.push({
              gradeId,
              sectionId,
              subjectId,
              reason: `Section with ID ${sectionId} not found`,
            });
            continue;
          }

          if (!subject) {
            skipped.push({
              gradeId,
              sectionId,
              subjectId,
              reason: `Subject with ID ${subjectId} not found`,
            });
            continue;
          }

          // Check if offering already exists
          const existing = await offeringRepo.findOne({
            where: {
              academicYearId,
              gradeId,
              sectionId,
              subjectId,
            },
          });

          if (existing) {
            skipped.push({
              gradeId,
              sectionId,
              subjectId,
              reason: `Class offering already exists for ${grade.name}, Section ${section.name}, ${subject.name}`,
            });
            continue;
          }

          // Create the offering
          try {
            const offering = offeringRepo.create({
              academicYearId,
              gradeId,
              sectionId,
              subjectId,
              teacherId,
              name: null, // Use default naming
            });

            const saved = await offeringRepo.save(offering);

            created.push({
              classOfferingId: saved.id,
              gradeId,
              sectionId,
              subjectId,
            });
          } catch (error) {
            // Log error and skip this combination
            this.logger.warn(
              `Failed to create offering for grade ${gradeId}, section ${sectionId}, subject ${subjectId}: ${error.message}`,
            );
            skipped.push({
              gradeId,
              sectionId,
              subjectId,
              reason: `Failed to create: ${error.message}`,
            });
          }
        }
      }
    });

    return {
      created,
      skipped,
      summary: {
        totalRequested,
        successCount: created.length,
        skippedCount: skipped.length,
      },
    };
  }
}
