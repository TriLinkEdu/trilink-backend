import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AttendanceSession } from './entities/attendance-session.entity';
import { AttendanceMark } from './entities/attendance-mark.entity';
import { Enrollment } from '../enrollments/entities/enrollment.entity';
import { ParentStudent } from '../parent-students/entities/parent-student.entity';
import { ClassOffering } from '../class-offerings/entities/class-offering.entity';
import { Subject } from '../school-structure/entities/subject.entity';
import { Grade } from '../school-structure/entities/grade.entity';
import { Section } from '../school-structure/entities/section.entity';
import { User, UserRole } from '../users/entities/user.entity';
import { NotificationsService } from '../notifications/notifications.service';
import { GamificationService } from '../gamification/gamification.service';
import { AuditService } from '../audit/audit.service';

@Injectable()
export class AttendanceService {
  constructor(
    @InjectRepository(AttendanceSession) private readonly sessRepo: Repository<AttendanceSession>,
    @InjectRepository(AttendanceMark) private readonly markRepo: Repository<AttendanceMark>,
    @InjectRepository(Enrollment) private readonly enrRepo: Repository<Enrollment>,
    @InjectRepository(ParentStudent) private readonly psRepo: Repository<ParentStudent>,
    @InjectRepository(ClassOffering) private readonly coRepo: Repository<ClassOffering>,
    @InjectRepository(Subject) private readonly subjectRepo: Repository<Subject>,
    @InjectRepository(Grade) private readonly gradeRepo: Repository<Grade>,
    @InjectRepository(Section) private readonly sectionRepo: Repository<Section>,
    @InjectRepository(User) private readonly userRepo: Repository<User>,
    private readonly notifications: NotificationsService,
    private readonly gamification: GamificationService,
    private readonly audit: AuditService,
  ) {}

  // ─── Access guards ────────────────────────────────────────────────────────

  async assertStudentViewer(viewer: User, studentId: string) {
    if (viewer.role === UserRole.ADMIN || viewer.role === UserRole.TEACHER) return;
    if (viewer.role === UserRole.STUDENT && viewer.id === studentId) return;
    if (viewer.role === UserRole.PARENT) {
      const link = await this.psRepo.findOne({ where: { parentId: viewer.id, studentId } });
      if (link) return;
    }
    throw new ForbiddenException('Cannot access this student');
  }

  private async assertTeacherOwnsClass(viewer: User, classOfferingId: string) {
    if (viewer.role === UserRole.ADMIN) return;
    if (viewer.role !== UserRole.TEACHER) {
      throw new ForbiddenException('Only staff can manage attendance for this class');
    }
    const co = await this.coRepo.findOne({ where: { id: classOfferingId } });
    if (!co) throw new NotFoundException('Class offering not found');
    if (co.teacherId !== viewer.id) throw new ForbiddenException('You do not teach this class');
  }

  // ─── Helpers ──────────────────────────────────────────────────────────────

  /** Enrich a ClassOffering with subject, grade, section, and teacher details. */
  private async enrichClassOffering(co: ClassOffering) {
    const [subject, grade, section, teacher] = await Promise.all([
      this.subjectRepo.findOne({ where: { id: co.subjectId } }),
      this.gradeRepo.findOne({ where: { id: co.gradeId } }),
      this.sectionRepo.findOne({ where: { id: co.sectionId } }),
      this.userRepo.findOne({ where: { id: co.teacherId } }),
    ]);
    return {
      classOfferingId: co.id,
      className: co.name ?? null,
      subject: subject ? { id: subject.id, name: subject.name, code: subject.code } : null,
      grade: grade ? { id: grade.id, name: grade.name } : null,
      section: section ? { id: section.id, name: section.name } : null,
      teacher: teacher
        ? {
            id: teacher.id,
            firstName: teacher.firstName,
            lastName: teacher.lastName,
            email: teacher.email,
            department: teacher.department ?? null,
            officeRoom: teacher.officeRoom ?? null,
          }
        : null,
    };
  }

  // ─── Session management ───────────────────────────────────────────────────

  async createSession(body: { classOfferingId: string; date: string; takenById: string }, viewer: User) {
    await this.assertTeacherOwnsClass(viewer, body.classOfferingId);
    const dup = await this.sessRepo.findOne({ where: { classOfferingId: body.classOfferingId, date: body.date } });
    if (dup) throw new ConflictException('Session already exists for this date');
    return this.sessRepo.save(this.sessRepo.create(body));
  }

  async listSessions(classOfferingId: string) {
    return this.sessRepo.find({ where: { classOfferingId }, order: { date: 'DESC' } });
  }

  /**
   * List all attendance sessions for the authenticated teacher across all their classes,
   * enriched with subject, grade, section details.
   */
  async listSessionsForTeacher(teacher: User) {
    // Find all class offerings taught by this teacher
    const offerings = await this.coRepo.find({ where: { teacherId: teacher.id } });
    if (!offerings.length) return [];

    const offeringIds = offerings.map((o) => o.id);
    const sessions = await this.sessRepo
      .createQueryBuilder('s')
      .where('s.class_offering_id IN (:...ids)', { ids: offeringIds })
      .orderBy('s.date', 'DESC')
      .getMany();

    // Build a map of enriched class offerings to avoid repeated DB calls
    const enrichedMap = new Map<string, Awaited<ReturnType<typeof this.enrichClassOffering>>>();
    for (const co of offerings) {
      enrichedMap.set(co.id, await this.enrichClassOffering(co));
    }

    return sessions.map((s) => ({
      sessionId: s.id,
      date: s.date,
      createdAt: s.createdAt,
      ...enrichedMap.get(s.classOfferingId),
    }));
  }

  // ─── Marks ────────────────────────────────────────────────────────────────

  async putMarks(
    sessionId: string,
    marks: { studentId: string; status: string; note?: string }[],
    viewer: User,
  ) {
    const session = await this.sessRepo.findOne({ where: { id: sessionId } });
    if (!session) throw new NotFoundException('Session not found');
    await this.assertTeacherOwnsClass(viewer, session.classOfferingId);
    const enrolled = await this.enrRepo.find({ where: { classOfferingId: session.classOfferingId, status: 'active' } });
    const ids = new Set(enrolled.map((e) => e.studentId));
    const validStatuses = new Set(['present', 'absent', 'excused']);
    for (const m of marks) {
      if (!ids.has(m.studentId)) throw new BadRequestException(`Student ${m.studentId} not in class`);
      if (!validStatuses.has(m.status)) throw new BadRequestException(`Invalid status "${m.status}". Allowed: present, absent, excused`);
      const existing = await this.markRepo.findOne({ where: { sessionId, studentId: m.studentId } });
      if (existing) {
        const before = { status: existing.status, note: existing.note ?? null };
        existing.status = m.status;
        existing.note = m.note ?? null;
        const saved = await this.markRepo.save(existing);
        await this.audit.log(
          viewer.id,
          viewer.role === UserRole.ADMIN ? 'attendance.mark_admin_override' : 'attendance.mark_update',
          'attendance_mark',
          saved.id,
          JSON.stringify({ sessionId, studentId: m.studentId, before, after: { status: saved.status, note: saved.note ?? null } }),
        );
      } else {
        const saved = await this.markRepo.save(this.markRepo.create({ sessionId, studentId: m.studentId, status: m.status, note: m.note ?? null }));
        await this.audit.log(
          viewer.id,
          'attendance.mark_create',
          'attendance_mark',
          saved.id,
          JSON.stringify({ sessionId, studentId: m.studentId, status: saved.status, note: saved.note ?? null }),
        );
      }
    }

    const dateStr = session.date;
    for (const m of marks) {
      const links = await this.psRepo.find({ where: { studentId: m.studentId } });
      for (const link of links) {
        await this.notifications.createForUser(link.parentId, {
          type: 'attendance',
          title: 'Attendance recorded',
          body: `Your child was marked "${m.status}" on ${dateStr}.`,
          payloadJson: JSON.stringify({ sessionId, studentId: m.studentId, status: m.status, date: dateStr }),
        });
      }
    }

    const touched = [...new Set(marks.map((m) => m.studentId))];
    await this.gamification.afterAttendanceMarksSaved(session.classOfferingId, session.date, touched);

    return this.markRepo.find({ where: { sessionId } });
  }

  async getMarks(sessionId: string) {
    return this.markRepo.find({ where: { sessionId } });
  }

  async editMark(
    markId: string,
    body: { status?: string; note?: string },
    viewer: User,
  ) {
    const mark = await this.markRepo.findOne({ where: { id: markId } });
    if (!mark) throw new NotFoundException('Mark not found');

    const session = await this.sessRepo.findOne({ where: { id: mark.sessionId } });
    if (!session) throw new NotFoundException('Session not found');

    await this.assertTeacherOwnsClass(viewer, session.classOfferingId);

    const validStatuses = new Set(['present', 'absent', 'excused']);
    const before = { status: mark.status, note: mark.note ?? null };
    if (body.status !== undefined) {
      if (!validStatuses.has(body.status)) {
        throw new BadRequestException(`Invalid status "${body.status}". Allowed: present, absent, excused`);
      }
      mark.status = body.status;
    }
    if (body.note !== undefined) mark.note = body.note ?? null;

    const saved = await this.markRepo.save(mark);
    await this.audit.log(
      viewer.id,
      viewer.role === UserRole.ADMIN ? 'attendance.mark_admin_override' : 'attendance.mark_update',
      'attendance_mark',
      saved.id,
      JSON.stringify({ sessionId: session.id, studentId: saved.studentId, before, after: { status: saved.status, note: saved.note ?? null } }),
    );
    return saved;
  }

  // ─── Reports ──────────────────────────────────────────────────────────────

  /** Resolve a student's basic profile fields. */
  private async resolveStudent(studentId: string) {
    const student = await this.userRepo.findOne({ where: { id: studentId } });
    if (!student) return { studentId };
    return {
      studentId: student.id,
      firstName: student.firstName,
      lastName: student.lastName,
      email: student.email,
      grade: student.grade ?? null,
      section: student.section ?? null,
    };
  }

  /**
   * Full attendance history for a student, enriched with subject/teacher/grade/section per session.
   */
  async reportStudent(studentId: string, viewer: User) {
    await this.assertStudentViewer(viewer, studentId);
    const [studentInfo, marks] = await Promise.all([
      this.resolveStudent(studentId),
      this.markRepo.find({ where: { studentId } }),
    ]);

    const enriched = await Promise.all(
      marks.map(async (m) => {
        const session = await this.sessRepo.findOne({ where: { id: m.sessionId } });
        if (!session) return null;
        const co = await this.coRepo.findOne({ where: { id: session.classOfferingId } });
        if (!co) return null;
        const classDetail = await this.enrichClassOffering(co);
        return {
          markId: m.id,
          status: m.status,
          note: m.note ?? null,
          date: session.date,
          sessionId: session.id,
          ...classDetail,
        };
      }),
    );

    return {
      ...studentInfo,
      marks: enriched.filter(Boolean).sort((a, b) => (a!.date < b!.date ? 1 : -1)),
    };
  }

  /**
   * Attendance for a student on a specific date, enriched with subject/teacher/grade/section.
   * Used by parents and students to see what happened on a given day.
   */
  async reportStudentByDay(studentId: string, viewer: User, date: string) {
    await this.assertStudentViewer(viewer, studentId);
    const [studentInfo, marks] = await Promise.all([
      this.resolveStudent(studentId),
      this.markRepo.find({ where: { studentId } }),
    ]);

    const enriched = await Promise.all(
      marks.map(async (m) => {
        const session = await this.sessRepo.findOne({ where: { id: m.sessionId } });
        if (!session || session.date !== date) return null;
        const co = await this.coRepo.findOne({ where: { id: session.classOfferingId } });
        if (!co) return null;
        const classDetail = await this.enrichClassOffering(co);
        return {
          markId: m.id,
          status: m.status,
          note: m.note ?? null,
          sessionId: session.id,
          ...classDetail,
        };
      }),
    );

    return {
      ...studentInfo,
      date,
      records: enriched.filter(Boolean),
    };
  }

  /**
   * Attendance for a student grouped by subject.
   * Returns all sessions for that subject with per-session mark status.
   * Access: student (self), parent (linked child), teacher, admin.
   */
  async reportStudentBySubject(studentId: string, subjectId: string, viewer: User) {
    await this.assertStudentViewer(viewer, studentId);

    const [studentInfo, subject] = await Promise.all([
      this.resolveStudent(studentId),
      this.subjectRepo.findOne({ where: { id: subjectId } }),
    ]);

    const empty = {
      ...studentInfo,
      subjectId,
      subjectName: subject?.name ?? null,
      sessions: [],
      summary: { total: 0, present: 0, absent: 0, excused: 0, attendanceRate: null as number | null },
    };

    const enrollments = await this.enrRepo.find({ where: { studentId } });
    if (!enrollments.length) return empty;

    // Find class offerings for this subject the student is enrolled in
    const matchingOfferings: ClassOffering[] = [];
    for (const e of enrollments) {
      const co = await this.coRepo.findOne({ where: { id: e.classOfferingId, subjectId } });
      if (co) matchingOfferings.push(co);
    }
    if (!matchingOfferings.length) return empty;

    // Collect all sessions + marks across matching offerings
    const sessionRows: Array<{
      sessionId: string;
      date: string;
      status: string | null;
      note: string | null;
      classOfferingId: string;
      className: string | null;
      subject: { id: string; name: string; code: string | null } | null;
      grade: { id: string; name: string } | null;
      section: { id: string; name: string } | null;
      teacher: { id: string; firstName: string; lastName: string; email: string; department: string | null; officeRoom: string | null } | null;
    }> = [];

    for (const co of matchingOfferings) {
      const sessions = await this.sessRepo.find({ where: { classOfferingId: co.id }, order: { date: 'DESC' } });
      const classDetail = await this.enrichClassOffering(co);
      for (const session of sessions) {
        const mark = await this.markRepo.findOne({ where: { sessionId: session.id, studentId } });
        sessionRows.push({
          sessionId: session.id,
          date: session.date,
          status: mark?.status ?? null,
          note: mark?.note ?? null,
          ...classDetail,
        });
      }
    }

    sessionRows.sort((a, b) => (a.date < b.date ? 1 : -1));

    const total = sessionRows.length;
    const present = sessionRows.filter((s) => s.status === 'present').length;
    const absent = sessionRows.filter((s) => s.status === 'absent').length;
    const excused = sessionRows.filter((s) => s.status === 'excused').length;
    const attendanceRate = total > 0 ? Math.round((present / total) * 1000) / 10 : null;

    return {
      ...studentInfo,
      subjectId,
      subjectName: subject?.name ?? null,
      summary: { total, present, absent, excused, attendanceRate },
      sessions: sessionRows,
    };
  }

  async reportClass(classOfferingId: string) {
    const co = await this.coRepo.findOne({ where: { id: classOfferingId } });
    const classDetail = co ? await this.enrichClassOffering(co) : { classOfferingId };

    const sessions = await this.sessRepo.find({ where: { classOfferingId }, order: { date: 'DESC' } });
    const out = await Promise.all(
      sessions.map(async (s) => {
        const rawMarks = await this.markRepo.find({ where: { sessionId: s.id } });
        const enrichedMarks = await Promise.all(
          rawMarks.map(async (m) => {
            const student = await this.userRepo.findOne({ where: { id: m.studentId } });
            return {
              id: m.id,
              sessionId: m.sessionId,
              studentId: m.studentId,
              studentFirstName: student?.firstName ?? null,
              studentLastName: student?.lastName ?? null,
              studentEmail: student?.email ?? null,
              status: m.status,
              note: m.note,
              createdAt: m.createdAt,
            };
          }),
        );
        return { sessionId: s.id, date: s.date, marks: enrichedMarks };
      }),
    );

    return { ...classDetail, sessions: out };
  }
}
