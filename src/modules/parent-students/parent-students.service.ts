import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { ParentStudent } from './entities/parent-student.entity';
import { User, UserRole } from '../users/entities/user.entity';
import { Enrollment } from '../enrollments/entities/enrollment.entity';
import { Exam } from '../exams/entities/exam.entity';
import { ExamAttempt } from '../exams/entities/exam-attempt.entity';
import { Assignment } from '../assignments/entities/assignment.entity';
import { AssignmentSubmission } from '../assignments/entities/assignment-submission.entity';
import { ClassOffering } from '../class-offerings/entities/class-offering.entity';
import { Subject } from '../school-structure/entities/subject.entity';
import { Grade } from '../school-structure/entities/grade.entity';
import { Section } from '../school-structure/entities/section.entity';
import { ForbiddenException } from '@nestjs/common';

@Injectable()
export class ParentStudentsService {
  constructor(
    @InjectRepository(ParentStudent) private readonly repo: Repository<ParentStudent>,
    @InjectRepository(User) private readonly userRepo: Repository<User>,
    @InjectRepository(Enrollment) private readonly enrollmentRepo: Repository<Enrollment>,
    @InjectRepository(Exam) private readonly examRepo: Repository<Exam>,
    @InjectRepository(ExamAttempt) private readonly attemptRepo: Repository<ExamAttempt>,
    @InjectRepository(Assignment) private readonly assignmentRepo: Repository<Assignment>,
    @InjectRepository(AssignmentSubmission) private readonly submissionRepo: Repository<AssignmentSubmission>,
    @InjectRepository(ClassOffering) private readonly coRepo: Repository<ClassOffering>,
    @InjectRepository(Subject) private readonly subjectRepo: Repository<Subject>,
    @InjectRepository(Grade) private readonly gradeRepo: Repository<Grade>,
    @InjectRepository(Section) private readonly sectionRepo: Repository<Section>,
  ) {}

  async list(q: { parentId?: string; studentId?: string }) {
    const where: Record<string, string> = {};
    if (q.parentId) where.parentId = q.parentId;
    if (q.studentId) where.studentId = q.studentId;
    return this.repo.find({ where: Object.keys(where).length ? where : {} });
  }

  async myChildren(parentId: string) {
    const links = await this.repo.find({ where: { parentId } });
    const studentIds = links.map(l => l.studentId);
    if (!studentIds.length) return [];
    const students = await this.userRepo.findBy({
      id: In(studentIds),
    });
    // Only return non-sensitive fields
    return links.map(link => {
      const student = students.find(s => s.id === link.studentId);
      return {
        ...link,
        student: student
          ? {
              id: student.id,
              firstName: student.firstName,
              lastName: student.lastName,
              email: student.email,
              // Add more non-sensitive fields as needed
            }
          : null,
      };
    });
  }

  async create(body: { parentId: string; studentId: string; relationship: string; isPrimary?: boolean }) {
    const p = await this.userRepo.findOne({ where: { id: body.parentId } });
    const s = await this.userRepo.findOne({ where: { id: body.studentId } });
    if (!p || p.role !== UserRole.PARENT) throw new BadRequestException('parentId must be parent');
    if (!s || s.role !== UserRole.STUDENT) throw new BadRequestException('studentId must be student');
    const dup = await this.repo.findOne({ where: { parentId: body.parentId, studentId: body.studentId } });
    if (dup) throw new ConflictException('Link exists');
    return this.repo.save(this.repo.create({ ...body, isPrimary: body.isPrimary ?? false }));
  }

  async remove(id: string) {
    const r = await this.repo.findOne({ where: { id } });
    if (!r) throw new NotFoundException('Link not found');
    await this.repo.remove(r);
  }

  async deleteAllByParentId(parentId: string) {
    await this.repo.delete({ parentId });
  }

  /**
   * Parent: get upcoming exams and assignments for a linked child,
   * with their submission/attempt status.
   */
  async upcomingForChild(parentId: string, studentId: string) {
    const link = await this.repo.findOne({ where: { parentId, studentId } });
    if (!link) throw new ForbiddenException('Not linked to this student');

    const student = await this.userRepo.findOne({ where: { id: studentId } });
    if (!student) throw new NotFoundException('Student not found');

    // Get all active enrollments for the student
    const enrollments = await this.enrollmentRepo.find({ where: { studentId, status: 'active' } });
    const classIds = enrollments.map(e => e.classOfferingId);

    if (!classIds.length) {
      return { student: { id: student.id, firstName: student.firstName, lastName: student.lastName }, exams: [], assignments: [] };
    }

    // Enrich class offering helper
    const enrichClass = async (coId: string) => {
      const co = await this.coRepo.findOne({ where: { id: coId } });
      if (!co) return null;
      const [subject, grade, section] = await Promise.all([
        this.subjectRepo.findOne({ where: { id: co.subjectId } }),
        this.gradeRepo.findOne({ where: { id: co.gradeId } }),
        this.sectionRepo.findOne({ where: { id: co.sectionId } }),
      ]);
      return {
        classOfferingId: co.id,
        subjectName: subject?.name ?? null,
        subjectCode: subject?.code ?? null,
        gradeName: grade?.name ?? null,
        sectionName: section?.name ?? null,
      };
    };

    const now = new Date();

    // ── Exams ──────────────────────────────────────────────────────────────
    const exams = await this.examRepo
      .createQueryBuilder('e')
      .where('e.class_offering_id IN (:...ids)', { ids: classIds })
      .andWhere('e.published = :pub', { pub: true })
      .orderBy('e.opens_at', 'ASC')
      .getMany();

    const examResults = await Promise.all(exams.map(async (exam) => {
      const attempt = await this.attemptRepo.findOne({ where: { examId: exam.id, studentId } });
      const classDetail = await enrichClass(exam.classOfferingId ?? '');

      let status: string;
      if (attempt?.submittedAt) {
        status = attempt.releasedAt ? 'graded' : 'submitted';
      } else if (now > new Date(exam.closesAt)) {
        status = 'missed';
      } else if (now >= new Date(exam.opensAt)) {
        status = 'available';
      } else {
        status = 'upcoming';
      }

      return {
        id: exam.id,
        title: exam.title,
        opensAt: exam.opensAt,
        closesAt: exam.closesAt,
        durationMinutes: exam.durationMinutes,
        maxPoints: exam.maxPoints,
        status,
        score: attempt?.score ?? null,
        releasedAt: attempt?.releasedAt ?? null,
        attemptId: attempt?.id ?? null,
        ...classDetail,
      };
    }));

    // ── Assignments ────────────────────────────────────────────────────────
    const assignments = await this.assignmentRepo
      .createQueryBuilder('a')
      .where('a.class_offering_id IN (:...ids)', { ids: classIds })
      .andWhere('a.published = :pub', { pub: true })
      .orderBy('a.deadline', 'ASC')
      .getMany();

    const assignmentResults = await Promise.all(assignments.map(async (asgn) => {
      const submission = await this.submissionRepo.findOne({ where: { assignmentId: asgn.id, studentId } });
      const classDetail = await enrichClass(asgn.classOfferingId);

      let status: string;
      if (submission?.releasedAt) {
        status = 'graded';
      } else if (submission?.submittedAt) {
        status = 'submitted';
      } else if (now > new Date(asgn.deadline)) {
        status = 'overdue';
      } else {
        status = 'pending';
      }

      return {
        id: asgn.id,
        title: asgn.title,
        description: asgn.description,
        submissionType: asgn.submissionType,
        deadline: asgn.deadline,
        maxScore: asgn.maxScore,
        status,
        score: submission?.score ?? null,
        releasedAt: submission?.releasedAt ?? null,
        submittedAt: submission?.submittedAt ?? null,
        submissionId: submission?.id ?? null,
        ...classDetail,
      };
    }));

    return {
      student: {
        id: student.id,
        firstName: student.firstName,
        lastName: student.lastName,
        email: student.email,
      },
      exams: examResults,
      assignments: assignmentResults,
      summary: {
        examsTotal: examResults.length,
        examsUpcoming: examResults.filter(e => e.status === 'upcoming' || e.status === 'available').length,
        examsMissed: examResults.filter(e => e.status === 'missed').length,
        assignmentsTotal: assignmentResults.length,
        assignmentsPending: assignmentResults.filter(a => a.status === 'pending').length,
        assignmentsOverdue: assignmentResults.filter(a => a.status === 'overdue').length,
      },
    };
  }
}
