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
import { Grade } from '../school-structure/entities/grade.entity';
import { Section } from '../school-structure/entities/section.entity';

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
    @InjectRepository(Grade) private readonly gradeRepo: Repository<Grade>,
    @InjectRepository(Section) private readonly sectionRepo: Repository<Section>,
  ) {}

  async assertStudentViewer(viewer: User, studentId: string) {
    if (viewer.role === UserRole.ADMIN) return;
    if (viewer.role === UserRole.TEACHER) {
      const enrollments = await this.enrRepo.find({ where: { studentId, status: 'active' } });
      const classIds = enrollments.map((e) => e.classOfferingId);
      if (!classIds.length) {
        throw new ForbiddenException('Teacher cannot access students outside their classes');
      }
      const owns = await this.coRepo.findOne({ where: { id: In(classIds), teacherId: viewer.id } });
      if (owns) return;
      throw new ForbiddenException('Teacher cannot access students outside their classes');
    }
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

  private resolveDateRange(periodType: 'weekly' | 'monthly' | 'custom', startDate?: string, endDate?: string) {
    const now = new Date();
    const end = new Date(now);
    end.setHours(23, 59, 59, 999);
    const start = new Date(now);

    if (periodType === 'weekly') {
      start.setDate(start.getDate() - 6);
      start.setHours(0, 0, 0, 0);
      return { start, end };
    }

    if (periodType === 'monthly') {
      start.setDate(start.getDate() - 29);
      start.setHours(0, 0, 0, 0);
      return { start, end };
    }

    if (!startDate || !endDate) {
      throw new BadRequestException('startDate and endDate are required when periodType is custom');
    }
    const customStart = new Date(startDate);
    const customEnd = new Date(endDate);
    if (Number.isNaN(customStart.getTime()) || Number.isNaN(customEnd.getTime())) {
      throw new BadRequestException('Invalid date format (use YYYY-MM-DD)');
    }
    customStart.setHours(0, 0, 0, 0);
    customEnd.setHours(23, 59, 59, 999);
    if (customStart > customEnd) {
      throw new BadRequestException('startDate cannot be after endDate');
    }
    return { start: customStart, end: customEnd };
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
    if (!subjectIds.length) return { studentId, subjects: [] as unknown[] };

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
    const released = attempts.filter((a) => a.releasedAt != null && a.score != null);
    const examIds = [...new Set(released.map((a) => a.examId))];
    const exams = examIds.length ? await this.examRepo.find({ where: { id: In(examIds) } }) : [];
    const examMap = new Map(exams.map((e) => [e.id, e]));
    const coIdSet = new Set(coIds);
    for (const a of released) {
      const exam = examMap.get(a.examId);
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

  async studentMastery(studentId: string, viewer: User) {
    await this.assertStudentViewer(viewer, studentId);
    const u = await this.userRepo.findOne({ where: { id: studentId } });
    if (!u || u.role !== UserRole.STUDENT) throw new NotFoundException('Student not found');

    const enrollments = await this.enrRepo.find({
      where: { studentId, status: 'active' },
    });
    const classIds = enrollments.map((e) => e.classOfferingId);
    if (!classIds.length) return [];

    const offerings = await this.coRepo.find({ where: { id: In(classIds) } });
    const byClass = new Map(offerings.map((o) => [o.id, o]));

    const attempts = await this.attRepo.find({
      where: { studentId },
      order: { releasedAt: 'DESC' },
    });

    const released = attempts.filter((a) => a.releasedAt && a.score != null);
    const examIds = [...new Set(released.map((a) => a.examId))];
    const exams = examIds.length
      ? await this.examRepo.find({ where: { id: In(examIds) } })
      : [];
    const examMap = new Map(exams.map((e) => [e.id, e]));

    const rowsByClass = new Map<string, Array<{ score: number; max: number; releasedAt: Date }>>();
    for (const a of released) {
      const exam = examMap.get(a.examId);
      if (!exam?.classOfferingId || !byClass.has(exam.classOfferingId)) continue;
      if (!rowsByClass.has(exam.classOfferingId)) rowsByClass.set(exam.classOfferingId, []);
      rowsByClass.get(exam.classOfferingId)!.push({
        score: Number(a.score ?? 0),
        max: Number(exam.maxPoints ?? 100),
        releasedAt: a.releasedAt!,
      });
    }

    const mastery = [] as Array<{
      studentId: string;
      topicId: string;
      topicName: string;
      subjectId: string;
      masteryLevel: number;
      lastAssessed: string;
    }>;

    for (const [classOfferingId, rows] of rowsByClass.entries()) {
      if (!rows.length) continue;
      const avgPercent =
        rows.reduce((sum, r) => sum + (r.max > 0 ? r.score / r.max : 0), 0) /
        rows.length;
      const last = rows
        .map((r) => r.releasedAt)
        .sort((a, b) => b.getTime() - a.getTime())[0];
      const offering = byClass.get(classOfferingId)!;

      mastery.push({
        studentId,
        topicId: classOfferingId,
        topicName: offering.name ?? 'Course mastery',
        subjectId: offering.subjectId,
        masteryLevel: Math.max(0, Math.min(1, Math.round(avgPercent * 1000) / 1000)),
        lastAssessed: last.toISOString(),
      });
    }

    return mastery;
  }

  /** Generate comprehensive report for a student for weekly, monthly, or custom ranges. */
  async studentReport(
    studentId: string,
    viewer: User,
    periodType: 'weekly' | 'monthly' | 'custom',
    startDate?: string,
    endDate?: string,
  ) {
    await this.assertStudentViewer(viewer, studentId);
    const u = await this.userRepo.findOne({ where: { id: studentId } });
    if (!u || u.role !== UserRole.STUDENT) throw new NotFoundException('Student not found');

    const { start, end } = this.resolveDateRange(periodType, startDate, endDate);
    const startStr = start.toISOString().slice(0, 10);
    const endStr = end.toISOString().slice(0, 10);

    const enrollments = await this.enrRepo.find({ where: { studentId, status: 'active' } });
    const coIds = enrollments.map((e) => e.classOfferingId);
    const offerings = coIds.length ? await this.coRepo.find({ where: { id: In(coIds) } }) : [];
    const gradeIds = [...new Set(offerings.map((o) => o.gradeId))];
    const sectionIds = [...new Set(offerings.map((o) => o.sectionId))];
    const subjectIds = [...new Set(offerings.map((o) => o.subjectId))];
    const teacherIds = [...new Set(offerings.map((o) => o.teacherId))];
    const [subjects, grades, sections, teachers] = await Promise.all([
      subjectIds.length ? this.subjectRepo.find({ where: { id: In(subjectIds) } }) : Promise.resolve([]),
      gradeIds.length ? this.gradeRepo.find({ where: { id: In(gradeIds) } }) : Promise.resolve([]),
      sectionIds.length ? this.sectionRepo.find({ where: { id: In(sectionIds) } }) : Promise.resolve([]),
      teacherIds.length ? this.userRepo.find({ where: { id: In(teacherIds), role: UserRole.TEACHER } }) : Promise.resolve([]),
    ]);
    const subjectMap = new Map(subjects.map((s) => [s.id, s]));
    const gradeMap = new Map(grades.map((g) => [g.id, g]));
    const sectionMap = new Map(sections.map((s) => [s.id, s]));
    const teacherMap = new Map(teachers.map((t) => [t.id, t]));

    const attendance = await this.attendanceBreakdown(studentId, startStr, endStr);
    const exams = await this.examSummary(studentId, start, end);

    const sessionList = await this.sessRepo.find({ where: coIds.length ? { classOfferingId: In(coIds) } : {} });
    const sessionsInRange = sessionList.filter((s) => s.date >= startStr && s.date <= endStr);
    const sessionsById = new Map(sessionsInRange.map((s) => [s.id, s]));
    const marks = await this.markRepo.find({ where: { studentId } });
    const markRows = marks.filter((m) => sessionsById.has(m.sessionId));

    const attempts = await this.attRepo.find({ where: { studentId }, order: { releasedAt: 'DESC' } });
    const releasedAttempts = attempts.filter((a) => a.releasedAt && a.releasedAt >= start && a.releasedAt <= end && a.score != null);
    const releasedExamIds = [...new Set(releasedAttempts.map((a) => a.examId))];
    const releasedExams = releasedExamIds.length ? await this.examRepo.find({ where: { id: In(releasedExamIds) } }) : [];
    const releasedExamMap = new Map(releasedExams.map((e) => [e.id, e]));

    const perCourse = offerings.map((co) => {
      const subject = subjectMap.get(co.subjectId);
      const grade = gradeMap.get(co.gradeId);
      const section = sectionMap.get(co.sectionId);
      const teacher = teacherMap.get(co.teacherId);

      const courseMarks = markRows
        .filter((m) => sessionsById.get(m.sessionId)?.classOfferingId === co.id)
        .map((m) => {
          const session = sessionsById.get(m.sessionId);
          return {
            sessionId: m.sessionId,
            date: session?.date ?? null,
            status: m.status,
            note: m.note,
          };
        });
      const statusCounts: Record<string, number> = {};
      for (const row of courseMarks) {
        statusCounts[row.status] = (statusCounts[row.status] || 0) + 1;
      }
      const totalAttendance = courseMarks.length;
      const presentLike = (statusCounts.present || 0) + (statusCounts.late || 0);
      const attendancePercent = totalAttendance > 0 ? Math.round((presentLike / totalAttendance) * 10000) / 100 : null;

      const courseAttempts = releasedAttempts
        .filter((a) => releasedExamMap.get(a.examId)?.classOfferingId === co.id)
        .map((a) => {
          const exam = releasedExamMap.get(a.examId);
          return {
            attemptId: a.id,
            examId: a.examId,
            examTitle: exam?.title ?? null,
            score: a.score,
            maxPoints: exam?.maxPoints ?? 100,
            releasedAt: a.releasedAt,
          };
        });
      const avgScore = courseAttempts.length
        ? Math.round(
            (courseAttempts.reduce((sum, x) => sum + ((x.score ?? 0) / (x.maxPoints || 100)) * 100, 0) / courseAttempts.length) *
              100,
          ) / 100
        : null;

      return {
        classOffering: {
          id: co.id,
          name: co.name,
          grade: { id: grade?.id ?? co.gradeId, name: grade?.name ?? null },
          section: { id: section?.id ?? co.sectionId, name: section?.name ?? null },
          subject: { id: subject?.id ?? co.subjectId, name: subject?.name ?? null, code: subject?.code ?? null },
          teacher: teacher
            ? {
                id: teacher.id,
                firstName: teacher.firstName,
                lastName: teacher.lastName,
                email: teacher.email,
                phone: teacher.phone,
                profileImageFileId: teacher.profileImageFileId,
              }
            : { id: co.teacherId, firstName: null, lastName: null, email: null, phone: null, profileImageFileId: null },
        },
        attendance: {
          totals: {
            total: totalAttendance,
            present: statusCounts.present || 0,
            late: statusCounts.late || 0,
            absent: statusCounts.absent || 0,
            excused: statusCounts.excused || 0,
            attendancePercent,
            scoringRule: 'excused counts as absent in percentage',
          },
          details: courseMarks,
        },
        assessments: {
          averagePercent: avgScore,
          releasedCount: courseAttempts.length,
          details: courseAttempts,
        },
      };
    });

    const subjectAverages = perCourse
      .map((c) => c.assessments.averagePercent)
      .filter((x): x is number => x !== null);
    const weeklyOrMonthlyAverageSubjectsPercent = subjectAverages.length
      ? Math.round((subjectAverages.reduce((a, b) => a + b, 0) / subjectAverages.length) * 100) / 100
      : null;
    const attendancePercent =
      attendance.totalMarks > 0
        ? Math.round(((((attendance.byStatus['present'] || 0) + (attendance.byStatus['late'] || 0)) / attendance.totalMarks) * 100) * 100) /
          100
        : null;

    return {
      studentId,
      student: {
        id: u.id,
        firstName: u.firstName,
        lastName: u.lastName,
        grade: u.grade,
        section: u.section,
        phone: u.phone,
        profileImageFileId: u.profileImageFileId,
      },
      period: {
        type: periodType,
        startDate: startStr,
        endDate: endStr,
      },
      generatedAt: new Date().toISOString(),
      summary: {
        overallSubjectsAveragePercent: weeklyOrMonthlyAverageSubjectsPercent,
        overallAttendancePercent: attendancePercent,
        attendanceScoringRule: 'excused is counted as absent in percentage calculations',
      },
      attendance,
      exams,
      courses: perCourse,
    };
  }

  /** Get teachers for a student (based on enrollments) */
  async getStudentTeachers(studentId: string, viewer: User) {
    await this.assertStudentViewer(viewer, studentId);
    const u = await this.userRepo.findOne({ where: { id: studentId } });
    if (!u || u.role !== UserRole.STUDENT) throw new NotFoundException('Student not found');

    // Get active enrollments
    const enrollments = await this.enrRepo.find({ where: { studentId, status: 'active' } });
    const coIds = enrollments.map((e) => e.classOfferingId);
    if (!coIds.length) return { studentId, teachers: [] };

    // Get class offerings and teacher IDs
    const offerings = await this.coRepo.find({ where: { id: In(coIds) } });
    const teacherIds = [...new Set(offerings.map((o) => o.teacherId))];
    if (!teacherIds.length) return { studentId, teachers: [] };

    // Get teacher details
    const teachers = await this.userRepo.find({ where: { id: In(teacherIds), role: UserRole.TEACHER } });

    // Get subject details
    const subjectIds = [...new Set(offerings.map((o) => o.subjectId))];
    const subjects = subjectIds.length ? await this.subjectRepo.find({ where: { id: In(subjectIds) } }) : [];
    const subjectMap = new Map(subjects.map((s) => [s.id, s.name]));

    // Map teachers to their subjects
    const teacherSubjects = new Map<string, string[]>();
    for (const offering of offerings) {
      const subjectName = subjectMap.get(offering.subjectId) ?? 'Unknown';
      if (!teacherSubjects.has(offering.teacherId)) {
        teacherSubjects.set(offering.teacherId, []);
      }
      if (!teacherSubjects.get(offering.teacherId)!.includes(subjectName)) {
        teacherSubjects.get(offering.teacherId)!.push(subjectName);
      }
    }

    return {
      studentId,
      teachers: teachers.map((t) => ({
        id: t.id,
        firstName: t.firstName,
        lastName: t.lastName,
        email: t.email,
        phone: t.phone,
        department: t.department,
        subjects: teacherSubjects.get(t.id) ?? [],
        profileImageFileId: t.profileImageFileId,
      })),
    };
  }
}
