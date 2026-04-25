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
    const results = await Promise.all(
      rows.map(async (e) => {
        const co = await this.classRepo.findOne({ where: { id: e.classOfferingId } });
        if (!co) return null;
        const [grade, section, subject, teacher] = await Promise.all([
          this.gradeRepo.findOne({ where: { id: co.gradeId } }),
          this.sectionRepo.findOne({ where: { id: co.sectionId } }),
          this.subjectRepo.findOne({ where: { id: co.subjectId } }),
          this.userRepo.findOne({ where: { id: co.teacherId } }),
        ]);
        return {
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
        };
      }),
    );
    return results.filter((r) => r !== null);
  }

  async listMine(studentId: string) {
    return this.buildEnrollmentDetails(studentId);
  }

  async classRoster(classOfferingId: string, viewer: User) {
    // Teachers can only see their own classes
    const co = await this.classRepo.findOne({ where: { id: classOfferingId } });
    if (!co) throw new NotFoundException('Class offering not found');
    if (viewer.role === UserRole.TEACHER && co.teacherId !== viewer.id) {
      throw new ForbiddenException('You do not teach this class');
    }

    const [grade, section, subject] = await Promise.all([
      this.gradeRepo.findOne({ where: { id: co.gradeId } }),
      this.sectionRepo.findOne({ where: { id: co.sectionId } }),
      this.subjectRepo.findOne({ where: { id: co.subjectId } }),
    ]);

    const enrollments = await this.repo.find({
      where: { classOfferingId, status: 'active' },
      order: { createdAt: 'ASC' },
    });

    const students = await Promise.all(
      enrollments.map(async (e) => {
        const student = await this.userRepo.findOne({ where: { id: e.studentId } });
        return {
          enrollmentId: e.id,
          studentId: e.studentId,
          firstName: student?.firstName ?? null,
          lastName: student?.lastName ?? null,
          email: student?.email ?? null,
          phone: student?.phone ?? null,
        };
      }),
    );

    return {
      classOfferingId: co.id,
      className: co.name ?? null,
      subject: subject ? { id: subject.id, name: subject.name, code: subject.code } : null,
      grade: grade ? { id: grade.id, name: grade.name } : null,
      section: section ? { id: section.id, name: section.name } : null,
      studentCount: students.length,
      students,
    };
  }

  async listForParentChild(parentId: string, studentId: string) {
    const link = await this.psRepo.findOne({ where: { parentId, studentId } });
    if (!link) throw new ForbiddenException('Not linked to this student');
    return this.buildEnrollmentDetails(studentId);
  }

  private async buildSubjectList(studentId: string) {
    const rows = await this.repo.find({ where: { studentId, status: 'active' }, order: { createdAt: 'DESC' } });
    const results = await Promise.all(
      rows.map(async (e) => {
        const co = await this.classRepo.findOne({ where: { id: e.classOfferingId } });
        if (!co) return null;
        const [grade, section, subject, teacher] = await Promise.all([
          this.gradeRepo.findOne({ where: { id: co.gradeId } }),
          this.sectionRepo.findOne({ where: { id: co.sectionId } }),
          this.subjectRepo.findOne({ where: { id: co.subjectId } }),
          this.userRepo.findOne({ where: { id: co.teacherId } }),
        ]);
        return {
          subjectId: subject?.id ?? co.subjectId,
          subjectName: subject?.name ?? null,
          subjectCode: subject?.code ?? null,
          classOfferingId: co.id,
          academicYearId: e.academicYearId,
          gradeName: grade?.name ?? null,
          sectionName: section?.name ?? null,
          teacher: teacher ? { id: teacher.id, firstName: teacher.firstName, lastName: teacher.lastName, email: teacher.email } : null,
        };
      }),
    );
    return results.filter((r) => r !== null);
  }

  async listSubjectsForStudent(studentId: string) {
    return this.buildSubjectList(studentId);
  }

  async listSubjectsForParentChild(parentId: string, studentId: string) {
    const link = await this.psRepo.findOne({ where: { parentId, studentId } });
    if (!link) throw new ForbiddenException('Not linked to this student');
    return this.buildSubjectList(studentId);
  }

  async create(body: { studentId: string; classOfferingId: string; academicYearId: string }) {
    const u = await this.userRepo.findOne({ where: { id: body.studentId } });
    if (!u || u.role !== UserRole.STUDENT) throw new BadRequestException('studentId must be a student');
    const c = await this.classRepo.findOne({ where: { id: body.classOfferingId } });
    if (!c) throw new NotFoundException('Class offering not found');
    if (c.academicYearId !== body.academicYearId) throw new BadRequestException('academicYearId mismatch with class offering');
    const dup = await this.repo.findOne({ where: { studentId: body.studentId, classOfferingId: body.classOfferingId } });
    if (dup) throw new ConflictException('Already enrolled');

    // A student can only have one active enrollment per academic year.
    const activeInYear = await this.repo.findOne({
      where: {
        studentId: body.studentId,
        academicYearId: body.academicYearId,
        status: 'active',
      },
    });
    if (activeInYear) {
      throw new ConflictException('Student already has an active class enrollment for this academic year');
    }

    return this.repo.save(this.repo.create({ ...body, status: 'active' }));
  }

  async remove(id: string) {
    const e = await this.repo.findOne({ where: { id } });
    if (!e) throw new NotFoundException('Enrollment not found');
    await this.repo.remove(e);
  }
}
