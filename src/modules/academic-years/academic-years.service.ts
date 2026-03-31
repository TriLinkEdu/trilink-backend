import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { AcademicYear } from './entities/academic-year.entity';
import { Term } from './entities/term.entity';
import { CreateAcademicYearDto } from './dto/create-academic-year.dto';
import { UpdateAcademicYearDto } from './dto/update-academic-year.dto';
import { CreateTermDto } from './dto/create-term.dto';
import { ClassOffering } from '../class-offerings/entities/class-offering.entity';

@Injectable()
export class AcademicYearsService {
  constructor(
    @InjectRepository(AcademicYear)
    private readonly yearRepo: Repository<AcademicYear>,
    @InjectRepository(Term)
    private readonly termRepo: Repository<Term>,
    @InjectRepository(ClassOffering)
    private readonly offeringRepo: Repository<ClassOffering>,
    private readonly dataSource: DataSource,
  ) {}

  async findAll(): Promise<AcademicYear[]> {
    return this.yearRepo.find({ order: { startDate: 'DESC' } });
  }

  async findOne(id: string): Promise<AcademicYear> {
    const y = await this.yearRepo.findOne({ where: { id }, relations: ['terms'] });
    if (!y) throw new NotFoundException('Academic year not found');
    return y;
  }

  async create(dto: CreateAcademicYearDto): Promise<AcademicYear> {
    const y = this.yearRepo.create({
      label: dto.label,
      startDate: dto.startDate,
      endDate: dto.endDate,
      isActive: dto.isActive ?? false,
    });
    if (y.isActive) await this.deactivateAll();
    return this.yearRepo.save(y);
  }

  async update(id: string, dto: UpdateAcademicYearDto): Promise<AcademicYear> {
    const y = await this.findOne(id);
    if (dto.label !== undefined) y.label = dto.label;
    if (dto.startDate !== undefined) y.startDate = dto.startDate;
    if (dto.endDate !== undefined) y.endDate = dto.endDate;
    if (dto.isArchived !== undefined) {
      if (dto.isArchived && y.isActive) y.isActive = false;
      y.isArchived = dto.isArchived;
    }
    return this.yearRepo.save(y);
  }

  async activate(id: string): Promise<AcademicYear> {
    const y = await this.findOne(id);
    if (y.isArchived) throw new BadRequestException('Cannot activate an archived year');
    await this.deactivateAll();
    y.isActive = true;
    return this.yearRepo.save(y);
  }

  async remove(id: string): Promise<void> {
    const y = await this.findOne(id);
    await this.yearRepo.remove(y);
  }

  private async deactivateAll(): Promise<void> {
    await this.yearRepo.createQueryBuilder().update(AcademicYear).set({ isActive: false }).execute();
  }

  async addTerm(yearId: string, dto: CreateTermDto): Promise<Term> {
    await this.findOne(yearId);
    const t = this.termRepo.create({
      academicYearId: yearId,
      name: dto.name,
      startDate: dto.startDate,
      endDate: dto.endDate,
    });
    return this.termRepo.save(t);
  }

  async listTerms(yearId: string): Promise<Term[]> {
    await this.findOne(yearId);
    return this.termRepo.find({ where: { academicYearId: yearId }, order: { startDate: 'ASC' } });
  }

  async removeTerm(termId: string): Promise<void> {
    const t = await this.termRepo.findOne({ where: { id: termId } });
    if (!t) throw new NotFoundException('Term not found');
    await this.termRepo.remove(t);
  }

  /** Copy class offering shells to a new year (no enrollments). */
  async rollover(sourceYearId: string, newLabel: string, dryRun = false): Promise<{ createdYearId?: string; offeringsCopied: number }> {
    const source = await this.findOne(sourceYearId);
    const offerings = await this.offeringRepo.find({ where: { academicYearId: sourceYearId } });
    if (dryRun) return { offeringsCopied: offerings.length };

    return this.dataSource.transaction(async (em) => {
      const yearRepo = em.getRepository(AcademicYear);
      const offRepo = em.getRepository(ClassOffering);
      await yearRepo.createQueryBuilder().update(AcademicYear).set({ isActive: false }).execute();
      const ny = yearRepo.create({
        label: newLabel,
        startDate: source.startDate,
        endDate: source.endDate,
        isActive: true,
        isArchived: false,
      });
      await yearRepo.save(ny);
      for (const o of offerings) {
        await offRepo.save(
          offRepo.create({
            academicYearId: ny.id,
            gradeId: o.gradeId,
            sectionId: o.sectionId,
            subjectId: o.subjectId,
            teacherId: o.teacherId,
            name: o.name,
          }),
        );
      }
      return { createdYearId: ny.id, offeringsCopied: offerings.length };
    });
  }

  async closeYear(id: string): Promise<AcademicYear> {
    const y = await this.findOne(id);
    y.isArchived = true;
    y.isActive = false;
    return this.yearRepo.save(y);
  }
}
