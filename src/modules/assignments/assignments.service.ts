import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Assignment, SubmissionType } from './entities/assignment.entity';
import { AssignmentSubmission, SubmissionStatus } from './entities/assignment-submission.entity';
import { User, UserRole } from '../users/entities/user.entity';
import { ClassOffering } from '../class-offerings/entities/class-offering.entity';
import { Enrollment } from '../enrollments/entities/enrollment.entity';
import { ParentStudent } from '../parent-students/entities/parent-student.entity';
import { Subject } from '../school-structure/entities/subject.entity';
import { Grade } from '../school-structure/entities/grade.entity';
import { Section } from '../school-structure/entities/section.entity';
import { FileRecord } from '../files/entities/file-record.entity';
import { NotificationsService } from '../notifications/notifications.service';
import { GradesService } from '../grades/grades.service';
import { GradeEntryType } from '../grades/entities/grade-entry.entity';

@Injectable()
export class AssignmentsService {
  constructor(
    @InjectRepository(Assignment) private readonly repo: Repository<Assignment>,
    @InjectRepository(AssignmentSubmission) private readonly subRepo: Repository<AssignmentSubmission>,
    @InjectRepository(User) private readonly userRepo: Repository<User>,
    @InjectRepository(ClassOffering) private readonly coRepo: Repository<ClassOffering>,
    @InjectRepository(Enrollment) private readonly enrRepo: Repository<Enrollment>,
    @InjectRepository(ParentStudent) private readonly psRepo: Repository<ParentStudent>,
    @InjectRepository(Subject) private readonly subjectRepo: Repository<Subject>,
    @InjectRepository(Grade) private readonly gradeRepo: Repository<Grade>,
    @InjectRepository(Section) private readonly sectionRepo: Repository<Section>,
    @InjectRepository(FileRecord) private readonly fileRepo: Repository<FileRecord>,
    private readonly notifications: NotificationsService,
    private readonly grades: GradesService,
  ) {}

  // ── Guards ────────────────────────────────────────────────────────────────

  private async assertTeacherOwns(assignment: Assignment, viewer: User) {
    if (viewer.role === UserRole.ADMIN) return;
    if (viewer.role === UserRole.TEACHER && assignment.teacherId === viewer.id) return;
    throw new ForbiddenException('You do not own this assignment');
  }

  private async assertStudentEnrolled(assignment: Assignment, studentId: string) {
    const enr = await this.enrRepo.findOne({ where: { classOfferingId: assignment.classOfferingId, studentId, status: 'active' } });
    if (!enr) throw new ForbiddenException('You are not enrolled in this class');
  }

  private async assertCanViewStudent(viewer: User, studentId: string) {
    if (viewer.role === UserRole.ADMIN || viewer.role === UserRole.TEACHER) return;
    if (viewer.role === UserRole.STUDENT && viewer.id === studentId) return;
    if (viewer.role === UserRole.PARENT) {
      const link = await this.psRepo.findOne({ where: { parentId: viewer.id, studentId } });
      if (link) return;
    }
    throw new ForbiddenException('Cannot access this student');
  }

  // ── Helpers ───────────────────────────────────────────────────────────────

  private async enrichAssignment(a: Assignment) {
    const co = await this.coRepo.findOne({ where: { id: a.classOfferingId } });
    const [subject, grade, section, teacher, attachment] = await Promise.all([
      co ? this.subjectRepo.findOne({ where: { id: co.subjectId } }) : null,
      co ? this.gradeRepo.findOne({ where: { id: co.gradeId } }) : null,
      co ? this.sectionRepo.findOne({ where: { id: co.sectionId } }) : null,
      this.userRepo.findOne({ where: { id: a.teacherId } }),
      a.attachmentFileId ? this.fileRepo.findOne({ where: { id: a.attachmentFileId } }) : null,
    ]);
    return {
      ...a,
      subject: subject ? { id: subject.id, name: subject.name, code: subject.code } : null,
      grade: grade ? { id: grade.id, name: grade.name } : null,
      section: section ? { id: section.id, name: section.name } : null,
      teacher: teacher ? { id: teacher.id, firstName: teacher.firstName, lastName: teacher.lastName, email: teacher.email } : null,
      attachment: attachment ? { id: attachment.id, filename: attachment.filename, mime: attachment.mime, path: attachment.path } : null,
      isOverdue: new Date() > new Date(a.deadline),
    };
  }

  // ── Teacher CRUD ──────────────────────────────────────────────────────────

  async create(body: {
    classOfferingId: string;
    title: string;
    description?: string;
    submissionType: SubmissionType;
    attachmentFileId?: string;
    deadline: string;
    maxScore?: number;
    termId?: string;
  }, teacher: User) {
    const co = await this.coRepo.findOne({ where: { id: body.classOfferingId } });
    if (!co) throw new NotFoundException('Class offering not found');
    if (teacher.role === UserRole.TEACHER && co.teacherId !== teacher.id) {
      throw new ForbiddenException('You do not teach this class');
    }
    const assignment = await this.repo.save(this.repo.create({
      classOfferingId: body.classOfferingId,
      teacherId: teacher.id,
      title: body.title,
      description: body.description ?? null,
      submissionType: body.submissionType,
      attachmentFileId: body.attachmentFileId ?? null,
      deadline: new Date(body.deadline),
      maxScore: body.maxScore ?? 100,
      termId: body.termId ?? null,
      published: false,
    }));
    return this.enrichAssignment(assignment);
  }

  async update(id: string, body: Partial<{
    title: string;
    description: string;
    submissionType: SubmissionType;
    attachmentFileId: string | null;
    deadline: string;
    maxScore: number;
    termId: string | null;
  }>, viewer: User) {
    const a = await this.repo.findOne({ where: { id } });
    if (!a) throw new NotFoundException('Assignment not found');
    await this.assertTeacherOwns(a, viewer);
    if (a.published) throw new BadRequestException('Cannot edit a published assignment. Unpublish first.');
    if (body.title !== undefined) a.title = body.title;
    if (body.description !== undefined) a.description = body.description;
    if (body.submissionType !== undefined) a.submissionType = body.submissionType;
    if (body.attachmentFileId !== undefined) a.attachmentFileId = body.attachmentFileId;
    if (body.deadline !== undefined) a.deadline = new Date(body.deadline);
    if (body.maxScore !== undefined) a.maxScore = body.maxScore;
    if (body.termId !== undefined) a.termId = body.termId;
    const saved = await this.repo.save(a);
    return this.enrichAssignment(saved);
  }

  async publish(id: string, viewer: User) {
    const a = await this.repo.findOne({ where: { id } });
    if (!a) throw new NotFoundException('Assignment not found');
    await this.assertTeacherOwns(a, viewer);
    if (a.published) throw new BadRequestException('Already published');
    a.published = true;
    await this.repo.save(a);

    // Notify all enrolled students
    const enrollments = await this.enrRepo.find({ where: { classOfferingId: a.classOfferingId, status: 'active' } });
    const deadlineStr = new Date(a.deadline).toLocaleDateString();
    for (const e of enrollments) {
      await this.notifications.createForUser(e.studentId, {
        type: 'assignment',
        title: `New assignment: ${a.title}`,
        body: `Due ${deadlineStr}. ${a.description ? a.description.slice(0, 100) : ''}`,
        payloadJson: JSON.stringify({ assignmentId: a.id, classOfferingId: a.classOfferingId }),
      });
    }
    return { ok: true, notified: enrollments.length };
  }

  async unpublish(id: string, viewer: User) {
    const a = await this.repo.findOne({ where: { id } });
    if (!a) throw new NotFoundException('Assignment not found');
    await this.assertTeacherOwns(a, viewer);
    a.published = false;
    return this.repo.save(a);
  }

  async remove(id: string, viewer: User) {
    const a = await this.repo.findOne({ where: { id } });
    if (!a) throw new NotFoundException('Assignment not found');
    await this.assertTeacherOwns(a, viewer);
    if (a.published) throw new BadRequestException('Unpublish before deleting');
    await this.repo.remove(a);
    return { ok: true };
  }

  // ── Listing ───────────────────────────────────────────────────────────────

  async listForTeacher(teacherId: string, classOfferingId?: string, termId?: string) {
    const qb = this.repo.createQueryBuilder('a')
      .where('a.teacher_id = :tid', { tid: teacherId })
      .orderBy('a.deadline', 'ASC');
    if (classOfferingId) qb.andWhere('a.class_offering_id = :cid', { cid: classOfferingId });
    if (termId) qb.andWhere('a.term_id = :tid', { tid: termId });
    const list = await qb.getMany();
    return Promise.all(list.map(a => this.enrichAssignment(a)));
  }

  async listForStudent(studentId: string, viewer: User, termId?: string) {
    await this.assertCanViewStudent(viewer, studentId);
    const enrollments = await this.enrRepo.find({ where: { studentId, status: 'active' } });
    const classIds = enrollments.map(e => e.classOfferingId);
    if (!classIds.length) return [];

    const qb = this.repo
      .createQueryBuilder('a')
      .where('a.class_offering_id IN (:...ids)', { ids: classIds })
      .andWhere('a.published = :pub', { pub: true })
      .orderBy('a.deadline', 'ASC');
    if (termId) qb.andWhere('a.term_id = :tid', { tid: termId });
    const assignments = await qb.getMany();

    return Promise.all(assignments.map(async (a) => {
      const enriched = await this.enrichAssignment(a);
      const submission = await this.subRepo.findOne({ where: { assignmentId: a.id, studentId } });
      return { ...enriched, submission: submission ?? null };
    }));
  }

  async getOne(id: string, viewer: User) {
    const a = await this.repo.findOne({ where: { id } });
    if (!a) throw new NotFoundException('Assignment not found');

    if (viewer.role === UserRole.STUDENT) {
      if (!a.published) throw new ForbiddenException('Assignment not published');
      await this.assertStudentEnrolled(a, viewer.id);
    } else if (viewer.role === UserRole.TEACHER) {
      await this.assertTeacherOwns(a, viewer);
    }

    const enriched = await this.enrichAssignment(a);
    if (viewer.role === UserRole.STUDENT) {
      const submission = await this.subRepo.findOne({ where: { assignmentId: id, studentId: viewer.id } });
      return { ...enriched, submission: submission ?? null };
    }
    return enriched;
  }

  // ── Submissions ───────────────────────────────────────────────────────────

  async submit(assignmentId: string, body: { fileId?: string; textContent?: string }, student: User) {
    const a = await this.repo.findOne({ where: { id: assignmentId } });
    if (!a) throw new NotFoundException('Assignment not found');
    if (!a.published) throw new BadRequestException('Assignment not published');
    if (new Date() > new Date(a.deadline)) throw new BadRequestException('Deadline has passed');
    await this.assertStudentEnrolled(a, student.id);

    if (a.submissionType === SubmissionType.FILE && !body.fileId) {
      throw new BadRequestException('File upload required for this assignment');
    }
    if (a.submissionType === SubmissionType.TEXT && !body.textContent?.trim()) {
      throw new BadRequestException('Text response required for this assignment');
    }

    let sub = await this.subRepo.findOne({ where: { assignmentId, studentId: student.id } });
    if (sub && sub.status !== SubmissionStatus.PENDING) {
      throw new BadRequestException('Already submitted');
    }

    if (!sub) {
      sub = this.subRepo.create({ assignmentId, studentId: student.id });
    }
    sub.fileId = body.fileId ?? null;
    sub.textContent = body.textContent ?? null;
    sub.status = SubmissionStatus.SUBMITTED;
    sub.submittedAt = new Date();
    const saved = await this.subRepo.save(sub);

    // Notify teacher
    const studentUser = await this.userRepo.findOne({ where: { id: student.id } });
    await this.notifications.createForUser(a.teacherId, {
      type: 'assignment_submission',
      title: 'New submission',
      body: `${studentUser?.firstName ?? 'A student'} submitted "${a.title}"`,
      payloadJson: JSON.stringify({ assignmentId, submissionId: saved.id, studentId: student.id }),
    });

    return saved;
  }

  async listSubmissions(assignmentId: string, viewer: User) {
    const a = await this.repo.findOne({ where: { id: assignmentId } });
    if (!a) throw new NotFoundException('Assignment not found');
    await this.assertTeacherOwns(a, viewer);

    const subs = await this.subRepo.find({ where: { assignmentId }, order: { submittedAt: 'DESC' } });
    return Promise.all(subs.map(async (s) => {
      const student = await this.userRepo.findOne({ where: { id: s.studentId } });
      const file = s.fileId ? await this.fileRepo.findOne({ where: { id: s.fileId } }) : null;
      return {
        ...s,
        student: student ? { id: student.id, firstName: student.firstName, lastName: student.lastName, email: student.email } : null,
        file: file ? { id: file.id, filename: file.filename, mime: file.mime, path: file.path } : null,
      };
    }));
  }

  async gradeSubmission(submissionId: string, body: { score: number; feedback?: string }, viewer: User) {
    const sub = await this.subRepo.findOne({ where: { id: submissionId } });
    if (!sub) throw new NotFoundException('Submission not found');
    const a = await this.repo.findOne({ where: { id: sub.assignmentId } });
    if (!a) throw new NotFoundException('Assignment not found');
    await this.assertTeacherOwns(a, viewer);

    if (body.score < 0 || body.score > a.maxScore) {
      throw new BadRequestException(`Score must be between 0 and ${a.maxScore}`);
    }

    sub.score = body.score;
    sub.feedback = body.feedback ?? null;
    sub.status = SubmissionStatus.GRADED;
    sub.gradedById = viewer.id;
    const saved = await this.subRepo.save(sub);
    return saved;
  }

  async releaseGrade(submissionId: string, viewer: User) {
    const sub = await this.subRepo.findOne({ where: { id: submissionId } });
    if (!sub) throw new NotFoundException('Submission not found');
    const a = await this.repo.findOne({ where: { id: sub.assignmentId } });
    if (!a) throw new NotFoundException('Assignment not found');
    await this.assertTeacherOwns(a, viewer);
    if (sub.score == null) throw new BadRequestException('Grade the submission before releasing');

    sub.status = SubmissionStatus.RETURNED;
    sub.releasedAt = new Date();
    const saved = await this.subRepo.save(sub);

    // Notify student
    const scoreLabel = `${sub.score} / ${a.maxScore}`;
    await this.notifications.createForUser(sub.studentId, {
      type: 'assignment_graded',
      title: 'Assignment graded',
      body: `Your submission for "${a.title}" has been graded (${scoreLabel}).`,
      payloadJson: JSON.stringify({ assignmentId: a.id, submissionId: sub.id, score: sub.score, maxScore: a.maxScore }),
    });

    // Auto-create grade entry
    void this.grades.autoCreateFromAssignment({
      classOfferingId: a.classOfferingId,
      studentId: sub.studentId,
      teacherId: a.teacherId,
      title: a.title,
      submissionId: sub.id,
      score: sub.score,
      maxScore: a.maxScore,
    }).catch(() => {});

    return saved;
  }

  async releaseAllGrades(assignmentId: string, viewer: User) {
    const a = await this.repo.findOne({ where: { id: assignmentId } });
    if (!a) throw new NotFoundException('Assignment not found');
    await this.assertTeacherOwns(a, viewer);

    const subs = await this.subRepo.find({ where: { assignmentId } });
    const toRelease = subs.filter(s => s.score != null && !s.releasedAt);
    for (const sub of toRelease) {
      await this.releaseGrade(sub.id, viewer);
    }
    return { released: toRelease.length };
  }
}
