import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { Grade } from './entities/grade.entity';
import { GradeSectionAssignment } from './entities/grade-section-assignment.entity';
import { GradeSubjectAssignment } from './entities/grade-subject-assignment.entity';
import { Section } from './entities/section.entity';
import { Subject } from './entities/subject.entity';
import { GradeSectionService } from './services/grade-section.service';

@Injectable()
export class SchoolStructureService {
  constructor(
    @InjectRepository(Grade) private readonly gradeRepo: Repository<Grade>,
    @InjectRepository(Section) private readonly sectionRepo: Repository<Section>,
    @InjectRepository(Subject) private readonly subjectRepo: Repository<Subject>,
    private readonly gradeSectionService: GradeSectionService,
    private readonly dataSource: DataSource,
  ) {}

  // Grades
  gradesList() {
    return this.gradeRepo.find({ order: { orderIndex: 'ASC', name: 'ASC' } });
  }
  async gradeCreate(body: { name: string; orderIndex?: number; sectionIds?: string[]; subjectIds?: string[] }) {
    return await this.dataSource.transaction(async (manager) => {
      // 1. Create the grade
      const grade = manager.create(Grade, {
        name: body.name,
        orderIndex: body.orderIndex ?? 0,
      });
      await manager.save(grade);

      // 2. Assign sections if provided
      if (body.sectionIds && body.sectionIds.length > 0) {
        const foundSections = await manager.findByIds(Section, body.sectionIds);
        if (foundSections.length !== body.sectionIds.length) {
          const foundIds = new Set(foundSections.map((s) => s.id));
          const missing = body.sectionIds.filter((id) => !foundIds.has(id));
          throw new NotFoundException(`One or more sections not found: ${missing.join(', ')}`);
        }
        const sectionAssignments = body.sectionIds.map((sectionId) =>
          manager.create(GradeSectionAssignment, { gradeId: grade.id, sectionId }),
        );
        await manager.save(GradeSectionAssignment, sectionAssignments);
      }

      // 3. Assign subjects if provided
      if (body.subjectIds && body.subjectIds.length > 0) {
        const foundSubjects = await manager.findByIds(Subject, body.subjectIds);
        if (foundSubjects.length !== body.subjectIds.length) {
          const foundIds = new Set(foundSubjects.map((s) => s.id));
          const missing = body.subjectIds.filter((id) => !foundIds.has(id));
          throw new NotFoundException(`One or more subjects not found: ${missing.join(', ')}`);
        }
        const subjectAssignments = body.subjectIds.map((subjectId) =>
          manager.create(GradeSubjectAssignment, { gradeId: grade.id, subjectId }),
        );
        await manager.save(GradeSubjectAssignment, subjectAssignments);
      }

      return grade;
    });
  }
  async gradeUpdate(id: string, body: Partial<{ name: string; orderIndex: number }>) {
    const g = await this.gradeRepo.findOne({ where: { id } });
    if (!g) throw new NotFoundException('Grade not found');
    Object.assign(g, body);
    return this.gradeRepo.save(g);
  }
  async gradeRemove(id: string) {
    const g = await this.gradeRepo.findOne({ where: { id } });
    if (!g) throw new NotFoundException('Grade not found');
    await this.gradeRepo.remove(g);
  }

  // Sections
  sectionsList() {
    return this.sectionRepo.find({ order: { name: 'ASC' } });
  }
  async sectionCreate(body: { name: string }) {
    return this.sectionRepo.save(this.sectionRepo.create({ name: body.name }));
  }
  async sectionUpdate(id: string, body: { name: string }) {
    const s = await this.sectionRepo.findOne({ where: { id } });
    if (!s) throw new NotFoundException('Section not found');
    s.name = body.name;
    return this.sectionRepo.save(s);
  }
  async sectionRemove(id: string) {
    const s = await this.sectionRepo.findOne({ where: { id } });
    if (!s) throw new NotFoundException('Section not found');
    await this.sectionRepo.remove(s);
  }

  // Subjects
  subjectsList() {
    return this.subjectRepo.find({ order: { name: 'ASC' } });
  }
  async subjectCreate(body: { name: string; code?: string }) {
    return this.subjectRepo.save(this.subjectRepo.create({ name: body.name, code: body.code ?? null }));
  }
  async subjectUpdate(id: string, body: Partial<{ name: string; code: string }>) {
    const s = await this.subjectRepo.findOne({ where: { id } });
    if (!s) throw new NotFoundException('Subject not found');
    Object.assign(s, body);
    return this.subjectRepo.save(s);
  }
  async subjectRemove(id: string) {
    const s = await this.subjectRepo.findOne({ where: { id } });
    if (!s) throw new NotFoundException('Subject not found');
    await this.subjectRepo.remove(s);
  }
}
