import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Grade } from './entities/grade.entity';
import { Section } from './entities/section.entity';
import { Subject } from './entities/subject.entity';

@Injectable()
export class SchoolStructureService {
  constructor(
    @InjectRepository(Grade) private readonly gradeRepo: Repository<Grade>,
    @InjectRepository(Section) private readonly sectionRepo: Repository<Section>,
    @InjectRepository(Subject) private readonly subjectRepo: Repository<Subject>,
  ) {}

  // Grades
  gradesList() {
    return this.gradeRepo.find({ order: { orderIndex: 'ASC', name: 'ASC' } });
  }
  async gradeCreate(body: { name: string; orderIndex?: number }) {
    return this.gradeRepo.save(this.gradeRepo.create({ name: body.name, orderIndex: body.orderIndex ?? 0 }));
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
