import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { User, UserRole } from '../users/entities/user.entity';
import { ParentStudent } from '../parent-students/entities/parent-student.entity';
import { AttendanceMark } from '../attendance/entities/attendance-mark.entity';
import { AttendanceSession } from '../attendance/entities/attendance-session.entity';
import { ExamAttempt } from '../exams/entities/exam-attempt.entity';
import { Exam } from '../exams/entities/exam.entity';
import { Enrollment } from '../enrollments/entities/enrollment.entity';
import { ClassOffering } from '../class-offerings/entities/class-offering.entity';
import { Subject } from '../school-structure/entities/subject.entity';

@Injectable()
export class ReportsService {
  constructor(
    @InjectRepository(User) private readonly userRepo: Repository<User>,
    @InjectRepository(ParentStudent) private readonly psRepo: Repository<ParentStudent>,
    @InjectRepository(AttendanceMark) private readonly markRepo: Repository<AttendanceMark>,
    @InjectRepository(AttendanceSession) private readonly sessRepo: Repository<AttendanceSession>,
    @InjectRepository(ExamAttempt) private readonly attRepo: Repository<ExamAttempt>,
    @InjectRepository(Exam) private readonly examRepo: Repository<Exam>,
    @InjectRepository(Enrollment) private readonly enrRepo: Repository<Enrollment>,
    @InjectRepository(ClassOffering) private readonly coRepo: Repository<ClassOffering>,
    @InjectRepository(Subject) private readonly subjectRepo: Repository<Subject>,
  ) {}

  async assertStudentViewer(viewer: User, studentId: string) {
    if (viewer.role === UserRole.ADMIN || viewer.role === UserRole.TEACHER) return;
    if (viewer.role === UserRole.STUDENT && viewer.id === studentId) return;
    if (viewer.role === UserRole.PARENT) {
      const link = await this.psRepo.findOne({ where: { parentId: viewer.id, studentId } });
      if (link) return;
    }
    throw new ForbiddenException('Cannot access this student');
  }

  private async sessionDateMap(): Promise<Map<string, string>> {
    const sessions = await this.sessRepo.find();
    return new Map(sessions.map((s) => [s.id, s.date]));
  }

  private async attendanceBreakdown(studentId: string, fromDate: string, toDate: string) {
    const dates = await this.sessionDateMap();
    const marks = await this.markRepo.find({ where: { studentId } });
    const filtered = marks.filter((m) => {
      const d = dates.get(m.sessionId);
      return d && d >= fromDate && d <= toDate;
    });
    const byStatus: Record<string, number> = {};
    for (const m of filtered) {
      byStatus[m.status] = (byStatus[m.status] || 0) + 1;
    }
    const total = filtered.length;
    const presentLike = (byStatus['present'] || 0) + (byStatus['late'] || 0);
    return {
      totalMarks: total,
      byStatus,
      presentOrLateRate: total > 0 ? Math.round((presentLike / total) * 1000) / 1000 : null,
    };
  }

  private async examSummary(studentId: string, releasedFrom?: Date, releasedTo?: Date) {
    const attempts = await this.attRepo.find({
      where: { studentId },
      order: { releasedAt: 'DESC' },
    });
    const filtered = attempts.filter(
      (a) =>
        a.releasedAt != null &&
        a.score != null &&
        (!releasedFrom || a.releasedAt >= releasedFrom) &&
        (!releasedTo || a.releasedAt <= releasedTo),
    );
    const detail: unknown[] = [];
    for (const a of filtered) {
      const e = await this.examRepo.findOne({ where: { id: a.examId } });
      detail.push({
        attemptId: a.id,
        score: a.score,
        maxPoints: e?.maxPoints,
        title: e?.title,
        releasedAt: a.releasedAt,
      });
    }
    const scores = filtered.map((x) => x.score!);
    const avg = scores.length ? scores.reduce((x, y) => x + y, 0) / scores.length : null;
    return {
      releasedAttempts: filtered.length,
      averageScore: avg != null ? Math.round(avg * 100) / 100 : null,
      recent: detail.slice(0, 15),
    };
  }

  async performanceReport(studentId: string, viewer: User) {
    await this.assertStudentViewer(viewer, studentId);
    const u = await this.userRepo.findOne({ where: { id: studentId } });
    if (!u || u.role !== UserRole.STUDENT) throw new NotFoundException('Student not found');

    const now = new Date();
    const from90 = new Date(now);
    from90.setDate(from90.getDate() - 90);
    const from90s = from90.toISOString().slice(0, 10);
    const today = now.toISOString().slice(0, 10);

    const attendance = await this.attendanceBreakdown(studentId, '1970-01-01', '9999-12-31');
    const attendance90 = await this.attendanceBreakdown(studentId, from90s, today);
    const exams = await this.examSummary(studentId);

    return {
      studentId,
      student: { firstName: u.firstName, lastName: u.lastName, grade: u.grade, section: u.section },
      generatedAt: now.toISOString(),
      attendanceAllTime: attendance,
      attendanceLast90Days: attendance90,
      examsReleased: exams,
    };
  }

  async comparePeriods(
    studentId: string,
    viewer: User,
    period1Start: string,
    period1End: string,
    period2Start: string,
    period2End: string,
  ) {
    if (!period1Start || !period1End || !period2Start || !period2End) {
      throw new BadRequestException('Query params period1Start, period1End, period2Start, period2End are required');
    }
    await this.assertStudentViewer(viewer, studentId);
    const p1a = new Date(period1Start);
    const p1b = new Date(period1End);
    const p2a = new Date(period2Start);
    const p2b = new Date(period2End);
    if ([p1a, p1b, p2a, p2b].some((d) => Number.isNaN(d.getTime()))) {
      throw new BadRequestException('Invalid date range (use ISO 8601)');
    }

    const d1s = period1Start.slice(0, 10);
    const d1e = period1End.slice(0, 10);
    const d2s = period2Start.slice(0, 10);
    const d2e = period2End.slice(0, 10);

    const att1 = await this.attendanceBreakdown(studentId, d1s, d1e);
    const att2 = await this.attendanceBreakdown(studentId, d2s, d2e);
    const ex1 = await this.examSummary(studentId, p1a, p1b);
    const ex2 = await this.examSummary(studentId, p2a, p2b);

    return {
      studentId,
      period1: { start: period1Start, end: period1End, attendance: att1, exams: ex1 },
      period2: { start: period2Start, end: period2End, attendance: att2, exams: ex2 },
    };
  }

  async weeklyParentSummary(viewer: User, childStudentId?: string) {
    if (viewer.role === UserRole.ADMIN) {
      if (!childStudentId) throw new BadRequestException('childStudentId query required for admin');
      const u = await this.userRepo.findOne({ where: { id: childStudentId } });
      if (!u || u.role !== UserRole.STUDENT) throw new NotFoundException('Student not found');
      return this.buildWeeklySnapshotForStudentIds([childStudentId]);
    }
    if (viewer.role !== UserRole.PARENT) {
      throw new ForbiddenException('Parents only (or admin with childStudentId)');
    }
    const links = await this.psRepo.find({ where: { parentId: viewer.id } });
    let ids = links.map((l) => l.studentId);
    if (childStudentId) {
      if (!ids.includes(childStudentId)) throw new ForbiddenException('Not linked to this student');
      ids = [childStudentId];
    }
    return this.buildWeeklySnapshotForStudentIds(ids);
  }

  /** Used by HTTP weekly summary and scheduled parent digest. */
  async buildWeeklySnapshotForStudentIds(studentIds: string[]) {
    const now = new Date();
    const weekAgo = new Date(now);
    weekAgo.setDate(weekAgo.getDate() - 7);
    const d0 = weekAgo.toISOString().slice(0, 10);
    const d1 = now.toISOString().slice(0, 10);

    const children: unknown[] = [];
    for (const sid of studentIds) {
      const u = await this.userRepo.findOne({ where: { id: sid } });
      const att = await this.attendanceBreakdown(sid, d0, d1);
      const attempts = await this.attRepo.find({
        where: { studentId: sid },
        order: { releasedAt: 'DESC' },
      });
      const thisWeek = attempts.filter((a) => a.releasedAt && a.releasedAt >= weekAgo);
      const examRows: unknown[] = [];
      for (const a of thisWeek.slice(0, 10)) {
        const e = await this.examRepo.findOne({ where: { id: a.examId } });
        examRows.push({ score: a.score, title: e?.title, releasedAt: a.releasedAt });
      }
      children.push({
        studentId: sid,
        name: u ? `${u.firstName} ${u.lastName}` : null,
        attendanceThisWeek: att,
        examsReleasedThisWeek: thisWeek.length,
        exams: examRows,
      });
    }

    return {
      weekFrom: d0,
      weekThrough: d1,
      generatedAt: now.toISOString(),
      children,
    };
  }

  async buildWeeklyDigestForParent(parentId: string) {
    const links = await this.psRepo.find({ where: { parentId } });
    const ids = links.map((l) => l.studentId);
    if (ids.length === 0) return null;
    return this.buildWeeklySnapshotForStudentIds(ids);
  }

  /** Released exam scores grouped by subject (from enrolled class offerings). */
  async myGradesBySubject(viewer: User) {
    if (viewer.role !== UserRole.STUDENT) throw new ForbiddenException('Students only');
    const studentId = viewer.id;
    const enrollments = await this.enrRepo.find({ where: { studentId, status: 'active' } });
    const coIds = enrollments.map((e) => e.classOfferingId);
    if (!coIds.length) return { studentId, subjects: [] as unknown[] };

    const offerings = await this.coRepo.find({ where: { id: In(coIds) } });
    const coToSubject = new Map(offerings.map((o) => [o.id, o.subjectId]));
    const subjectIds = [...new Set(offerings.map((o) => o.subjectId))];
    const subjects = await this.subjectRepo.find({ where: { id: In(subjectIds) } });
    const subjectName = new Map(subjects.map((s) => [s.id, s.name]));

    const bySubject = new Map<
      string,
      { subjectId: string; subjectName: string; exams: unknown[] }
    >();
    for (const sid of subjectIds) {
      bySubject.set(sid, {
        subjectId: sid,
        subjectName: subjectName.get(sid) ?? 'Unknown',
        exams: [],
      });
    }

    const attempts = await this.attRepo.find({ where: { studentId }, order: { releasedAt: 'DESC' } });
    const coIdSet = new Set(coIds);
    for (const a of attempts) {
      if (!a.releasedAt || a.score == null) continue;
      const exam = await this.examRepo.findOne({ where: { id: a.examId } });
      if (!exam?.classOfferingId || !coIdSet.has(exam.classOfferingId)) continue;
      const subjId = coToSubject.get(exam.classOfferingId);
      if (!subjId) continue;
      const bucket = bySubject.get(subjId);
      if (bucket) {
        bucket.exams.push({
          attemptId: a.id,
          examId: exam.id,
          title: exam.title,
          score: a.score,
          maxPoints: exam.maxPoints,
          releasedAt: a.releasedAt,
        });
      }
    }

    return { studentId, subjects: [...bySubject.values()] };
  }
}
