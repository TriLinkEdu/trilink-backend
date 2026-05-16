import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { GradeEntry, GradeEntryType } from './entities/grade-entry.entity';
import { User, UserRole } from '../users/entities/user.entity';
import { ClassOffering } from '../class-offerings/entities/class-offering.entity';
import { Enrollment } from '../enrollments/entities/enrollment.entity';
import { ParentStudent } from '../parent-students/entities/parent-student.entity';
import { NotificationsService } from '../notifications/notifications.service';
import { Grade } from '../school-structure/entities/grade.entity';
import { Section } from '../school-structure/entities/section.entity';
import { Subject } from '../school-structure/entities/subject.entity';

@Injectable()
export class GradesService {
  private readonly logger = new Logger(GradesService.name);

  constructor(
    @InjectRepository(GradeEntry) private readonly repo: Repository<GradeEntry>,
    @InjectRepository(User) private readonly userRepo: Repository<User>,
    @InjectRepository(ClassOffering) private readonly coRepo: Repository<ClassOffering>,
    @InjectRepository(Enrollment) private readonly enrollmentRepo: Repository<Enrollment>,
    @InjectRepository(ParentStudent) private readonly psRepo: Repository<ParentStudent>,
    @InjectRepository(Grade) private readonly gradeRepo: Repository<Grade>,
    @InjectRepository(Section) private readonly sectionRepo: Repository<Section>,
    @InjectRepository(Subject) private readonly subjectRepo: Repository<Subject>,
    private readonly notifications: NotificationsService,
  ) {}

  // ── Guards ────────────────────────────────────────────────────────────────

  private async assertTeacherOwnsClass(viewer: User, classOfferingId: string) {
    if (viewer.role === UserRole.ADMIN) return;
    const co = await this.coRepo.findOne({ where: { id: classOfferingId } });
    if (!co) throw new NotFoundException('Class offering not found');
    if (co.teacherId !== viewer.id) {
      this.logger.warn(
        `Forbidden: viewer ${viewer.id} (role=${viewer.role}) tried to access class ${classOfferingId} owned by teacher ${co.teacherId}`,
      );
      throw new ForbiddenException('You do not teach this class');
    }
  }

  // ── Helpers ───────────────────────────────────────────────────────────────

  private async enrichEntry(entry: GradeEntry) {
    const [student, co] = await Promise.all([
      this.userRepo.findOne({ where: { id: entry.studentId } }),
      this.coRepo.findOne({ where: { id: entry.classOfferingId } }),
    ]);
    let classDetail: Record<string, unknown> = {};
    if (co) {
      const [grade, section, subject] = await Promise.all([
        this.gradeRepo.findOne({ where: { id: co.gradeId } }),
        this.sectionRepo.findOne({ where: { id: co.sectionId } }),
        this.subjectRepo.findOne({ where: { id: co.subjectId } }),
      ]);
      classDetail = {
        gradeName: grade?.name ?? null,
        sectionName: section?.name ?? null,
        subjectName: subject?.name ?? null,
      };
    }
    return {
      ...entry,
      student: student
        ? { id: student.id, firstName: student.firstName, lastName: student.lastName, email: student.email }
        : null,
      ...classDetail,
    };
  }

  // ── CRUD ──────────────────────────────────────────────────────────────────

  /**
   * Create a single grade entry for one student.
   */
  async createEntry(
    body: {
      classOfferingId: string;
      studentId: string;
      title: string;
      type: GradeEntryType;
      score?: number | null;
      maxScore?: number;
      note?: string | null;
      examAttemptId?: string | null;
      termId: string;
    },
    teacher: User,
  ) {
    await this.assertTeacherOwnsClass(teacher, body.classOfferingId);

    // Validate student is enrolled
    const enrollment = await this.enrollmentRepo.findOne({
      where: { classOfferingId: body.classOfferingId, studentId: body.studentId, status: 'active' },
    });
    if (!enrollment) throw new BadRequestException('Student is not actively enrolled in this class');

    const entry = this.repo.create({
      classOfferingId: body.classOfferingId,
      studentId: body.studentId,
      teacherId: teacher.id,
      title: body.title,
      type: body.type,
      score: body.score ?? null,
      maxScore: body.maxScore ?? 100,
      note: body.note ?? null,
      examAttemptId: body.examAttemptId ?? null,
      termId: body.termId,
    });
    return this.repo.save(entry);
  }

  /**
   * Bulk-create/upsert grade entries for all students in a class for a given title.
   * e.g. teacher submits "Assignment 1" scores for all 30 students at once.
   */
  async bulkUpsertForClass(
    body: {
      classOfferingId: string;
      title: string;
      type: GradeEntryType;
      maxScore: number;
      note?: string | null;
      termId: string;
      entries: { studentId: string; score: number | null }[];
    },
    teacher: User,
  ) {
    await this.assertTeacherOwnsClass(teacher, body.classOfferingId);

    const saved: GradeEntry[] = [];
    for (const e of body.entries) {
      const existing = await this.repo.findOne({
        where: { classOfferingId: body.classOfferingId, studentId: e.studentId, title: body.title },
      });
      if (existing) {
        existing.score = e.score;
        existing.maxScore = body.maxScore;
        existing.note = body.note ?? existing.note;
        if (body.termId !== undefined) existing.termId = body.termId;
        saved.push(await this.repo.save(existing));
      } else {
        const entry = this.repo.create({
          classOfferingId: body.classOfferingId,
          studentId: e.studentId,
          teacherId: teacher.id,
          title: body.title,
          type: body.type,
          score: e.score,
          maxScore: body.maxScore,
          note: body.note ?? null,
          termId: body.termId,
        });
        saved.push(await this.repo.save(entry));
      }
    }
    return { saved: saved.length, entries: saved };
  }

  /**
   * Update a single grade entry (score, maxScore, note, title).
   */
  async updateEntry(
    id: string,
    body: Partial<Pick<GradeEntry, 'score' | 'maxScore' | 'note' | 'title' | 'type'>>,
    viewer: User,
  ) {
    const entry = await this.repo.findOne({ where: { id } });
    if (!entry) throw new NotFoundException('Grade entry not found');
    this.logger.debug(
      `updateEntry: viewer=${viewer.id} (role=${viewer.role}), entry.id=${entry.id}, entry.teacherId=${entry.teacherId}, entry.classOfferingId=${entry.classOfferingId}`,
    );
    // Allow if admin, or if teacher owns the class, or if teacher created this entry
    if (viewer.role !== UserRole.ADMIN) {
      if (entry.teacherId !== viewer.id) {
        await this.assertTeacherOwnsClass(viewer, entry.classOfferingId);
      }
    }
    Object.assign(entry, body);
    return this.repo.save(entry);
  }

  /**
   * Release grade entries to students (sends notification).
   * Can release a single entry or all entries for a class+title combo.
   */
  async releaseEntries(
    filter: { classOfferingId: string; title: string },
    viewer: User,
  ) {
    await this.assertTeacherOwnsClass(viewer, filter.classOfferingId);
    const entries = await this.repo.find({
      where: { classOfferingId: filter.classOfferingId, title: filter.title },
    });
    const now = new Date();
    for (const entry of entries) {
      if (!entry.releasedAt) {
        entry.releasedAt = now;
        await this.repo.save(entry);
        // Notify student
        const scoreLabel = entry.score != null ? `${entry.score} / ${entry.maxScore}` : `— / ${entry.maxScore}`;
        await this.notifications.createForUser(entry.studentId, {
          type: 'grade_released',
          title: 'Grade published',
          body: `Your result for "${entry.title}" is available (${scoreLabel}).`,
          payloadJson: JSON.stringify({ gradeEntryId: entry.id, title: entry.title, score: entry.score, maxScore: entry.maxScore }),
        });
        // Notify linked parents
        const links = await this.psRepo.find({ where: { studentId: entry.studentId } });
        for (const link of links) {
          await this.notifications.createForUser(link.parentId, {
            type: 'grade_released',
            title: "Your child's grade published",
            body: `Result for "${entry.title}" is available (${scoreLabel}).`,
            payloadJson: JSON.stringify({ gradeEntryId: entry.id, title: entry.title, score: entry.score, maxScore: entry.maxScore }),
          });
        }
      }
    }
    return { released: entries.length };
  }

  /**
   * Delete a single grade entry.
   */
  async deleteEntry(id: string, viewer: User) {
    const entry = await this.repo.findOne({ where: { id } });
    if (!entry) throw new NotFoundException('Grade entry not found');
    this.logger.debug(
      `deleteEntry: viewer=${viewer.id} (role=${viewer.role}), entry.id=${entry.id}, entry.teacherId=${entry.teacherId}, entry.classOfferingId=${entry.classOfferingId}`,
    );
    if (viewer.role !== UserRole.ADMIN) {
      if (entry.teacherId !== viewer.id) {
        await this.assertTeacherOwnsClass(viewer, entry.classOfferingId);
      }
    }
    await this.repo.remove(entry);
    return { ok: true };
  }

  /**
   * Delete an entire assessment (all entries with the given classOfferingId + title).
   */
  async deleteGroup(filter: { classOfferingId: string; title: string }, viewer: User) {
    await this.assertTeacherOwnsClass(viewer, filter.classOfferingId);
    const entries = await this.repo.find({
      where: { classOfferingId: filter.classOfferingId, title: filter.title },
    });
    if (entries.length === 0) throw new NotFoundException('Assessment not found');
    await this.repo.remove(entries);
    return { ok: true, deleted: entries.length };
  }

  // ── Queries ───────────────────────────────────────────────────────────────

  /**
   * List all grade entries for a class, grouped by title.
   * Teacher/admin view.
   */
  async listForClass(classOfferingId: string, viewer: User, termId?: string) {
    this.logger.debug(
      `listForClass: viewer=${viewer.id} (role=${viewer.role}), classOfferingId=${classOfferingId}, termId=${termId ?? 'none'}`,
    );
    await this.assertTeacherOwnsClass(viewer, classOfferingId);
    const where: Record<string, unknown> = { classOfferingId };
    if (termId) where.termId = termId;
    const entries = await this.repo.find({
      where,
      order: { createdAt: 'DESC' },
    });

    // Group by title
    const grouped = new Map<string, { title: string; type: GradeEntryType; maxScore: number; releasedAt: Date | null; entries: typeof entries }>();
    for (const e of entries) {
      if (!grouped.has(e.title)) {
        grouped.set(e.title, { title: e.title, type: e.type, maxScore: e.maxScore, releasedAt: e.releasedAt, entries: [] });
      }
      grouped.get(e.title)!.entries.push(e);
    }

    // Enrich each entry with student name
    const result = await Promise.all(
      [...grouped.values()].map(async (group) => ({
        title: group.title,
        type: group.type,
        maxScore: group.maxScore,
        releasedAt: group.releasedAt,
        studentCount: group.entries.length,
        entries: await Promise.all(
          group.entries.map(async (e) => {
            const student = await this.userRepo.findOne({ where: { id: e.studentId } });
            return {
              id: e.id,
              studentId: e.studentId,
              firstName: student?.firstName ?? null,
              lastName: student?.lastName ?? null,
              studentEmail: student?.email ?? null,
              score: e.score,
              maxScore: e.maxScore,
              note: e.note,
              releasedAt: e.releasedAt,
              examAttemptId: e.examAttemptId,
            };
          }),
        ),
      })),
    );

    return { classOfferingId, groups: result };
  }

  /**
   * Student/parent view: released grades for a student filtered by subject.
   * Resolves classOfferingId → subjectId to filter entries.
   */
  async listForStudentBySubject(studentId: string, subjectId: string, viewer: User) {
    if (viewer.role === UserRole.STUDENT && viewer.id !== studentId) {
      throw new ForbiddenException('Cannot view another student\'s grades');
    }
    if (viewer.role === UserRole.PARENT) {
      const link = await this.psRepo.findOne({ where: { parentId: viewer.id, studentId } });
      if (!link) throw new ForbiddenException('Not linked to this student');
    }

    const allEntries = await this.repo.find({ where: { studentId }, order: { createdAt: 'DESC' } });
    const visible = (viewer.role === UserRole.ADMIN || viewer.role === UserRole.TEACHER)
      ? allEntries
      : allEntries.filter((e) => e.releasedAt != null);

    // Filter by subject — resolve classOfferingId → subjectId
    const filtered: typeof visible = [];
    for (const e of visible) {
      const co = await this.coRepo.findOne({ where: { id: e.classOfferingId } });
      if (co?.subjectId === subjectId) filtered.push(e);
    }

    const enriched = await Promise.all(filtered.map((e) => this.enrichEntry(e)));
    const student = await this.userRepo.findOne({ where: { id: studentId } });
    const subject = await this.subjectRepo.findOne({ where: { id: subjectId } });

    return {
      studentId,
      studentName: student ? `${student.firstName} ${student.lastName}` : null,
      subjectId,
      subjectName: subject?.name ?? null,
      entries: enriched,
      summary: {
        total: enriched.length,
        withScore: enriched.filter((e) => e.score != null).length,
        averagePercent: (() => {
          const scored = enriched.filter((e) => e.score != null);
          if (!scored.length) return null;
          return Math.round(scored.reduce((s, e) => s + (e.score! / e.maxScore) * 100, 0) / scored.length * 10) / 10;
        })(),
      },
    };
  }

  /**
   * Student view: all released grade entries for themselves.
   */
  async listForStudent(studentId: string, viewer: User) {
    if (viewer.role === UserRole.STUDENT && viewer.id !== studentId) {
      throw new ForbiddenException('Cannot view another student\'s grades');
    }
    if (viewer.role === UserRole.PARENT) {
      const link = await this.psRepo.findOne({ where: { parentId: viewer.id, studentId } });
      if (!link) throw new ForbiddenException('Not linked to this student');
    }

    const entries = await this.repo.find({
      where: { studentId },
      order: { createdAt: 'DESC' },
    });

    // Only released entries for students/parents
    const visible = (viewer.role === UserRole.ADMIN || viewer.role === UserRole.TEACHER)
      ? entries
      : entries.filter((e) => e.releasedAt != null);

    return Promise.all(visible.map((e) => this.enrichEntry(e)));
  }

  /**
   * Get all released grade entries for a student filtered by termId.
   * Groups by subject.
   */
  async listForStudentByTerm(studentId: string, termId: string, viewer: User) {
    if (viewer.role === UserRole.STUDENT && viewer.id !== studentId) {
      throw new ForbiddenException('Cannot view another student\'s grades');
    }
    if (viewer.role === UserRole.PARENT) {
      const link = await this.psRepo.findOne({ where: { parentId: viewer.id, studentId } });
      if (!link) throw new ForbiddenException('Not linked to this student');
    }

    const entries = await this.repo.find({
      where: { studentId, termId },
      order: { createdAt: 'DESC' },
    });

    const visible =
      viewer.role === UserRole.ADMIN || viewer.role === UserRole.TEACHER
        ? entries
        : entries.filter((e) => e.releasedAt != null);

    // Group by subject via classOffering
    const subjectMap = new Map<
      string,
      { subjectId: string; subjectName: string; entries: typeof visible }
    >();

    for (const e of visible) {
      const co = await this.coRepo.findOne({ where: { id: e.classOfferingId } });
      if (!co) continue;
      const subject = await this.subjectRepo.findOne({ where: { id: co.subjectId } });
      const key = co.subjectId;
      if (!subjectMap.has(key)) {
        subjectMap.set(key, {
          subjectId: co.subjectId,
          subjectName: subject?.name ?? 'Unknown',
          entries: [],
        });
      }
      subjectMap.get(key)!.entries.push(e);
    }

    const student = await this.userRepo.findOne({ where: { id: studentId } });

    return {
      studentId,
      studentName: student ? `${student.firstName} ${student.lastName}` : null,
      termId,
      subjects: [...subjectMap.values()].map((s) => ({
        subjectId: s.subjectId,
        subjectName: s.subjectName,
        entries: s.entries.map((e) => ({
          id: e.id,
          title: e.title,
          type: e.type,
          score: e.score,
          maxScore: e.maxScore,
          percent:
            e.score != null && e.maxScore > 0
              ? Math.round((e.score / e.maxScore) * 1000) / 10
              : null,
          note: e.note,
          releasedAt: e.releasedAt,
          createdAt: e.createdAt,
        })),
      })),
    };
  }

  /**
   * Auto-create a grade entry from an assignment submission.
   */
  async autoCreateFromAssignment(body: {
    classOfferingId: string;
    studentId: string;
    teacherId: string;
    title: string;
    submissionId: string;
    score: number;
    maxScore: number;
    termId: string;
  }) {
    const existing = await this.repo.findOne({ where: { classOfferingId: body.classOfferingId, studentId: body.studentId, title: body.title } });
    if (existing) {
      existing.score = body.score;
      existing.maxScore = body.maxScore;
      return this.repo.save(existing);
    }
    return this.repo.save(this.repo.create({
      classOfferingId: body.classOfferingId,
      studentId: body.studentId,
      teacherId: body.teacherId,
      title: body.title,
      type: GradeEntryType.ASSIGNMENT,
      score: body.score,
      maxScore: body.maxScore,
      termId: body.termId,
      releasedAt: new Date(),
    }));
  }

  /**
   * Auto-create a grade entry when a student submits a platform exam.
   */
  async autoCreateFromExamAttempt(body: {
    classOfferingId: string;
    studentId: string;
    teacherId: string;
    examTitle: string;
    examAttemptId: string;
    score: number | null;
    maxScore: number;
    termId: string;
  }) {
    // Check if already exists for this attempt
    const existing = await this.repo.findOne({ where: { examAttemptId: body.examAttemptId } });
    if (existing) {
      // Update score if already exists (e.g. re-grade)
      existing.score = body.score;
      existing.maxScore = body.maxScore;
      return this.repo.save(existing);
    }
    return this.repo.save(
      this.repo.create({
        classOfferingId: body.classOfferingId,
        studentId: body.studentId,
        teacherId: body.teacherId,
        title: body.examTitle,
        type: GradeEntryType.EXAM,
        score: body.score,
        maxScore: body.maxScore,
        examAttemptId: body.examAttemptId,
        termId: body.termId,
      }),
    );
  }
}
