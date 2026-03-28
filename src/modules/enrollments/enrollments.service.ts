import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Enrollment } from './entities/enrollment.entity';
import { User, UserRole } from '../users/entities/user.entity';
import { ClassOffering } from '../class-offerings/entities/class-offering.entity';
import { Grade } from '../school-structure/entities/grade.entity';
import { Section } from '../school-structure/entities/section.entity';
import { Subject } from '../school-structure/entities/subject.entity';
import { ParentStudent } from '../parent-students/entities/parent-student.entity';

@Injectable()
export class EnrollmentsService {
  constructor(
    @InjectRepository(Enrollment) private readonly repo: Repository<Enrollment>,
    @InjectRepository(User) private readonly userRepo: Repository<User>,
    @InjectRepository(ClassOffering) private readonly classRepo: Repository<ClassOffering>,
    @InjectRepository(Grade) private readonly gradeRepo: Repository<Grade>,
    @InjectRepository(Section) private readonly sectionRepo: Repository<Section>,
    @InjectRepository(Subject) private readonly subjectRepo: Repository<Subject>,
    @InjectRepository(ParentStudent) private readonly psRepo: Repository<ParentStudent>,
  ) {}

  async list(q: { studentId?: string; classOfferingId?: string; academicYearId?: string }) {
    const where: Record<string, string> = {};
    if (q.studentId) where.studentId = q.studentId;
    if (q.classOfferingId) where.classOfferingId = q.classOfferingId;
    if (q.academicYearId) where.academicYearId = q.academicYearId;
    return this.repo.find({
      where: Object.keys(where).length ? where : {},
      order: { createdAt: 'DESC' },
    });
  }

  private async buildEnrollmentDetails(studentId: string) {
    const rows = await this.repo.find({
      where: { studentId, status: 'active' },
      order: { createdAt: 'DESC' },
    });
    const out: unknown[] = [];
    for (const e of rows) {
      const co = await this.classRepo.findOne({ where: { id: e.classOfferingId } });
      if (!co) continue;
      const [grade, section, subject, teacher] = await Promise.all([
        this.gradeRepo.findOne({ where: { id: co.gradeId } }),
        this.sectionRepo.findOne({ where: { id: co.sectionId } }),
        this.subjectRepo.findOne({ where: { id: co.subjectId } }),
        this.userRepo.findOne({ where: { id: co.teacherId } }),
      ]);
      out.push({
        enrollmentId: e.id,
        academicYearId: e.academicYearId,
        classOfferingId: co.id,
        className: co.name,
        grade: grade?.name ?? null,
        section: section?.name ?? null,
        subject: subject
          ? { id: subject.id, name: subject.name, code: subject.code }
          : null,
        teacher: teacher
          ? {
              id: teacher.id,
              firstName: teacher.firstName,
              lastName: teacher.lastName,
              email: teacher.email,
            }
          : null,
      });
    }
    return out;
  }

  async listMine(studentId: string) {
    return this.buildEnrollmentDetails(studentId);
  }

  async listForParentChild(parentId: string, studentId: string) {
    const link = await this.psRepo.findOne({ where: { parentId, studentId } });
    if (!link) throw new ForbiddenException('Not linked to this student');
    return this.buildEnrollmentDetails(studentId);
  }

  async create(body: { studentId: string; classOfferingId: string; academicYearId: string }) {
    const u = await this.userRepo.findOne({ where: { id: body.studentId } });
    if (!u || u.role !== UserRole.STUDENT) throw new BadRequestException('studentId must be a student');
    const c = await this.classRepo.findOne({ where: { id: body.classOfferingId } });
    if (!c) throw new NotFoundException('Class offering not found');
    if (c.academicYearId !== body.academicYearId) throw new BadRequestException('academicYearId mismatch with class offering');
    const dup = await this.repo.findOne({ where: { studentId: body.studentId, classOfferingId: body.classOfferingId } });
    if (dup) throw new ConflictException('Already enrolled');
    return this.repo.save(this.repo.create({ ...body, status: 'active' }));
  }

  async remove(id: string) {
    const e = await this.repo.findOne({ where: { id } });
    if (!e) throw new NotFoundException('Enrollment not found');
    await this.repo.remove(e);
  }
}
