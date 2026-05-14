import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { ClassOffering } from './entities/class-offering.entity';
import { User, UserRole } from '../users/entities/user.entity';
import { Grade } from '../school-structure/entities/grade.entity';
import { Section } from '../school-structure/entities/section.entity';
import { Subject } from '../school-structure/entities/subject.entity';

export type ClassOfferingWithLabels = ClassOffering & {
  gradeName: string | null;
  sectionName: string | null;
  subjectName: string | null;
  teacherName: string | null;
  displayName: string;
};

@Injectable()
export class ClassOfferingsService {
  constructor(
    @InjectRepository(ClassOffering) private readonly repo: Repository<ClassOffering>,
    @InjectRepository(User) private readonly userRepo: Repository<User>,
    @InjectRepository(Grade) private readonly gradeRepo: Repository<Grade>,
    @InjectRepository(Section) private readonly sectionRepo: Repository<Section>,
    @InjectRepository(Subject) private readonly subjectRepo: Repository<Subject>,
  ) {}

  async list(yearId: string): Promise<ClassOfferingWithLabels[]> {
    const rows = await this.repo.find({ where: { academicYearId: yearId }, order: { createdAt: 'DESC' } });
    return this.attachStructureLabels(rows);
  }

  async listForTeacher(teacherId: string, academicYearId: string): Promise<ClassOfferingWithLabels[]> {
    const rows = await this.repo.find({
      where: { teacherId, academicYearId },
      order: { createdAt: 'DESC' },
    });
    return this.attachStructureLabels(rows);
  }

  async listByIds(ids: string[]): Promise<ClassOfferingWithLabels[]> {
    if (!ids.length) return [];
    const rows = await this.repo.find({ where: { id: In(ids) } });
    return this.attachStructureLabels(rows);
  }

  private async attachStructureLabels(offerings: ClassOffering[]): Promise<ClassOfferingWithLabels[]> {
    if (!offerings.length) return [];
    const gradeIds = [...new Set(offerings.map((o) => o.gradeId))];
    const sectionIds = [...new Set(offerings.map((o) => o.sectionId))];
    const subjectIds = [...new Set(offerings.map((o) => o.subjectId))];
    const teacherIds = [...new Set(offerings.map((o) => o.teacherId))];
    const [grades, sections, subjects, teachers] = await Promise.all([
      this.gradeRepo.findBy({ id: In(gradeIds) }),
      this.sectionRepo.findBy({ id: In(sectionIds) }),
      this.subjectRepo.findBy({ id: In(subjectIds) }),
      this.userRepo.findBy({ id: In(teacherIds) }),
    ]);
    const gMap = new Map(grades.map((g) => [g.id, g.name]));
    const secMap = new Map(sections.map((s) => [s.id, s.name]));
    const subMap = new Map(subjects.map((s) => [s.id, s.name]));
    const teacherMap = new Map(teachers.map((t) => [t.id, `${t.firstName} ${t.lastName}`.trim() || t.email]));

    return offerings.map((co) => {
      const gradeName = gMap.get(co.gradeId) ?? null;
      const sectionName = secMap.get(co.sectionId) ?? null;
      const subjectName = subMap.get(co.subjectId) ?? null;
      const teacherName = teacherMap.get(co.teacherId) ?? null;
      const displayName = this.computeDisplayName(co, gradeName, sectionName, subjectName);
      return { ...co, gradeName, sectionName, subjectName, teacherName, displayName };
    });
  }

  /** Human-readable label: custom name, else e.g. "Grade 9 A | Mathematics". */
  private computeDisplayName(
    co: ClassOffering,
    gradeName: string | null,
    sectionName: string | null,
    subjectName: string | null,
  ): string {
    const custom = co.name?.trim();
    if (custom) return custom;
    const classPart = [gradeName, sectionName].filter(Boolean).join(' ').trim();
    const sub = subjectName?.trim();
    if (classPart && sub) return `${classPart} | ${sub}`;
    if (classPart) return classPart;
    if (sub) return sub;
    return 'Untitled Class';
  }

  private async findRaw(id: string): Promise<ClassOffering> {
    const o = await this.repo.findOne({ where: { id } });
    if (!o) throw new NotFoundException('Class offering not found');
    return o;
  }

  async one(id: string): Promise<ClassOfferingWithLabels> {
    const o = await this.findRaw(id);
    const [enriched] = await this.attachStructureLabels([o]);
    return enriched;
  }

  async oneForViewer(id: string, viewer: User): Promise<ClassOfferingWithLabels> {
    const o = await this.one(id);
    if (viewer.role === UserRole.ADMIN) return o;
    if (viewer.role === UserRole.TEACHER && o.teacherId === viewer.id) return o;
    throw new ForbiddenException('Cannot view this class offering');
  }

  async create(body: {
    academicYearId: string;
    gradeId: string;
    sectionId: string;
    subjectId: string;
    teacherId: string;
    name?: string;
  }) {
    const t = await this.userRepo.findOne({ where: { id: body.teacherId } });
    if (!t || t.role !== UserRole.TEACHER) throw new BadRequestException('teacherId must be a teacher user');
    
    try {
      return await this.repo.save(this.repo.create(body));
    } catch (error) {
      // Check if it's a unique constraint violation
      if (error.code === '23505' || error.message?.includes('duplicate') || error.message?.includes('unique')) {
        // Fetch names for better error message
        const [grade, section, subject] = await Promise.all([
          this.gradeRepo.findOne({ where: { id: body.gradeId } }),
          this.sectionRepo.findOne({ where: { id: body.sectionId } }),
          this.subjectRepo.findOne({ where: { id: body.subjectId } }),
        ]);
        
        const gradeName = grade?.name ?? 'Unknown Grade';
        const sectionName = section?.name ?? 'Unknown Section';
        const subjectName = subject?.name ?? 'Unknown Subject';
        
        throw new ConflictException(
          `Class offering already exists for ${gradeName}, Section ${sectionName}, ${subjectName} in this academic year`,
        );
      }
      // Re-throw other errors
      throw error;
    }
  }

  async update(id: string, body: Partial<Pick<ClassOffering, 'teacherId' | 'name'>>) {
    const o = await this.findRaw(id);
    if (body.teacherId) {
      const t = await this.userRepo.findOne({ where: { id: body.teacherId } });
      if (!t || t.role !== UserRole.TEACHER) throw new BadRequestException('teacherId must be a teacher user');
      o.teacherId = body.teacherId;
    }
    if (body.name !== undefined) o.name = body.name;
    return this.repo.save(o);
  }

  async remove(id: string) {
    await this.repo.remove(await this.findRaw(id));
  }
}
