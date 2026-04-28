import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { Feedback } from '../feedback/entities/feedback.entity';
import { Exam } from '../exams/entities/exam.entity';
import { ExamAttempt } from '../exams/entities/exam-attempt.entity';
import { AttendanceMark } from '../attendance/entities/attendance-mark.entity';
import { AttendanceSession } from '../attendance/entities/attendance-session.entity';
import { Announcement } from '../announcements/entities/announcement.entity';
import { User, UserRole } from '../users/entities/user.entity';
import { Enrollment } from '../enrollments/entities/enrollment.entity';
import { ClassOffering } from '../class-offerings/entities/class-offering.entity';
import { StudentGoal } from '../goals/entities/student-goal.entity';

@Injectable()
export class AnalyticsService {
  constructor(
    @InjectRepository(Feedback) private readonly fbRepo: Repository<Feedback>,
    @InjectRepository(Exam) private readonly examRepo: Repository<Exam>,
    @InjectRepository(ExamAttempt) private readonly attRepo: Repository<ExamAttempt>,
    @InjectRepository(AttendanceMark) private readonly markRepo: Repository<AttendanceMark>,
    @InjectRepository(Announcement) private readonly annRepo: Repository<Announcement>,
    @InjectRepository(User) private readonly userRepo: Repository<User>,
    @InjectRepository(Enrollment) private readonly enrRepo: Repository<Enrollment>,
    @InjectRepository(ClassOffering) private readonly coRepo: Repository<ClassOffering>,
    @InjectRepository(StudentGoal) private readonly goalRepo: Repository<StudentGoal>,
  ) {}

  async adminSummary() {
    const since = new Date();
    since.setDate(since.getDate() - 30);

    const feedbackByStatus = await this.fbRepo
      .createQueryBuilder('f')
      .select('f.status', 'status')
      .addSelect('COUNT(*)', 'cnt')
      .groupBy('f.status')
      .getRawMany();

    const examsPublished = await this.examRepo.count({ where: { published: true } });
    const attemptsSubmitted = await this.attRepo
      .createQueryBuilder('a')
      .where('a.submitted_at IS NOT NULL')
      .getCount();

    const attemptsReleased = await this.attRepo
      .createQueryBuilder('a')
      .where('a.released_at IS NOT NULL')
      .getCount();

    const marksLast30 = await this.markRepo
      .createQueryBuilder('m')
      .where('m.created_at >= :s', { s: since })
      .getCount();

    const presentLast30 = await this.markRepo
      .createQueryBuilder('m')
      .where('m.created_at >= :s', { s: since })
      .andWhere("m.status IN ('present','late')")
      .getCount();

    const announcements = await this.annRepo.count();

    const [admin, teacher, student, parent] = await Promise.all([
      this.userRepo.count({ where: { role: UserRole.ADMIN } }),
      this.userRepo.count({ where: { role: UserRole.TEACHER } }),
      this.userRepo.count({ where: { role: UserRole.STUDENT } }),
      this.userRepo.count({ where: { role: UserRole.PARENT } }),
    ]);

    return {
      generatedAt: new Date().toISOString(),
      users: { admin, teacher, student, parent, total: admin + teacher + student + parent },
      feedbackTicketsByStatus: feedbackByStatus.map((r) => ({
        status: r.status,
        count: parseInt(r.cnt, 10),
      })),
      exams: { publishedCount: examsPublished },
      examAttempts: { submitted: attemptsSubmitted, released: attemptsReleased },
      attendance: {
        marksRecordedLast30Days: marksLast30,
        presentOrLateLast30Days: presentLast30,
        presentRateLast30DaysApprox:
          marksLast30 > 0 ? Math.round((presentLast30 / marksLast30) * 1000) / 1000 : null,
      },
      announcementsTotal: announcements,
    };
  }

  async studentWeeklySnapshot(studentId: string) {
    const [marks, trends] = await Promise.all([
      this.fetchAttendanceMarks(studentId),
      this.studentPerformanceTrends(studentId),
    ]);

    const attendanceRate = this.presentRate(marks);
    const averageQuizScore =
      trends.subjects.length === 0
        ? 0
        : trends.subjects
              .map((s) => (s.points.length ? s.points[s.points.length - 1].value : 0))
              .reduce((a, b) => a + b, 0) / trends.subjects.length;

    const dueAssignments = 0;
    const trend = averageQuizScore >= 70 ? 'up' : 'flat';
    const focusSubjects = trends.subjects
      .map((s) => ({ name: s.subjectName, score: s.points.length ? s.points[s.points.length - 1].value : 0 }))
      .sort((a, b) => a.score - b.score)
      .slice(0, 2)
      .map((s) => s.name);

    return {
      attendanceRate,
      averageQuizScore,
      dueAssignments,
      trend,
      focusSubjects,
      summary: `Attendance is ${Math.round(attendanceRate * 100)}%, average score is ${Math.round(
        averageQuizScore,
      )}%, and ${dueAssignments} tasks need attention this week.`,
    };
  }

  async studentPerformanceTrends(studentId: string) {
    const activeClassIds = await this.activeClassOfferingIds(studentId);
    if (!activeClassIds.length) {
      return { examReadinessScore: 0, subjects: [] };
    }

    const attempts = await this.attRepo
      .createQueryBuilder('a')
      .innerJoin(Exam, 'e', 'e.id = a.exam_id')
      .select([
        'a.id as attemptId',
        'a.exam_id as examId',
        'a.score as score',
        'a.max_points_snapshot as maxPoints',
        'a.released_at as releasedAt',
        'e.class_offering_id as classOfferingId',
      ])
      .where('a.student_id = :sid', { sid: studentId })
      .andWhere('a.released_at IS NOT NULL')
      .andWhere('e.class_offering_id IN (:...cids)', { cids: activeClassIds })
      .orderBy('a.released_at', 'ASC')
      .getRawMany();

    const classMap = await this.classNameMap(activeClassIds);
    const byClass = new Map<
      string,
      Array<{ score: number; max: number; releasedAt: string | null }>
    >();

    for (const row of attempts) {
      const cid = row.classOfferingId as string;
      if (!byClass.has(cid)) byClass.set(cid, []);
      byClass.get(cid)!.push({
        score: Number(row.score ?? 0),
        max: Number(row.maxPoints ?? 100),
        releasedAt: row.releasedAt ? String(row.releasedAt) : null,
      });
    }

    const subjects = [] as Array<{
      subjectId: string;
      subjectName: string;
      points: Array<{ label: string; value: number }>;
      strengthTopics: string[];
      riskTopics: string[];
      recommendation: string;
    }>;

    for (const [subjectId, rows] of byClass.entries()) {
      if (!rows.length) continue;
      const points = rows.map((r) => {
        const value = r.max > 0 ? (r.score / r.max) * 100 : 0;
        const d = r.releasedAt ? new Date(r.releasedAt) : null;
        return {
          label: d ? `${d.getMonth() + 1}/${d.getDate()}` : 'Recent',
          value,
        };
      });
      const recent = points[points.length - 1]?.value ?? 0;
      subjects.push({
        subjectId,
        subjectName: classMap.get(subjectId) ?? 'Subject',
        points,
        strengthTopics: recent >= 70 ? ['Recent assessments'] : [],
        riskTopics: recent < 70 ? ['Recent assessments'] : [],
        recommendation:
          recent < 70
            ? `Prioritize revision tasks for ${classMap.get(subjectId) ?? 'this subject'} this week.`
            : `Maintain momentum in ${classMap.get(subjectId) ?? 'this subject'} with one focused practice set daily.`,
      });
    }

    const examReadinessScore = subjects.length
      ? Math.round(
          subjects
            .map((s) => (s.points.length ? s.points[s.points.length - 1].value : 0))
            .reduce((a, b) => a + b, 0) / subjects.length,
        )
      : 0;

    return { examReadinessScore, subjects };
  }

  async studentAttendanceInsights(studentId: string) {
    const marks = await this.fetchAttendanceMarks(studentId);
    if (!marks.length) {
      return {
        currentRate: 0,
        weeklyTrend: [],
        riskLevel: 'High',
        projectedMonthEndRate: 0,
        bestDay: 'N/A',
        weakDay: 'N/A',
      };
    }

    const currentRate = this.presentRate(marks);

    const byWeek = new Map<string, number[]>();
    const byDay = new Map<number, number[]>();
    for (const m of marks) {
      const date = new Date(m.sessionDate);
      const weekKey = `${date.getUTCFullYear()}-W${Math.floor((date.getUTCDate() - 1) / 7) + 1}-${
        date.getUTCMonth() + 1
      }`;
      const v = m.status === 'present' || m.status === 'late' ? 100 : 0;
      if (!byWeek.has(weekKey)) byWeek.set(weekKey, []);
      byWeek.get(weekKey)!.push(v);
      if (!byDay.has(date.getUTCDay())) byDay.set(date.getUTCDay(), []);
      byDay.get(date.getUTCDay())!.push(v);
    }

    const weeklyTrend = [...byWeek.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .slice(-4)
      .map(([label, vals]) => ({
        label,
        value: vals.reduce((a, b) => a + b, 0) / vals.length,
      }));

    const scoredDays = [...byDay.entries()].map(([d, vals]) => ({
      day: d,
      avg: vals.reduce((a, b) => a + b, 0) / vals.length,
    }));
    scoredDays.sort((a, b) => b.avg - a.avg);
    const bestDay = this.dayName(scoredDays[0]?.day);
    const weakDay = this.dayName(scoredDays[scoredDays.length - 1]?.day);

    return {
      currentRate,
      weeklyTrend,
      riskLevel: currentRate >= 0.9 ? 'Low' : currentRate >= 0.75 ? 'Medium' : 'High',
      projectedMonthEndRate: currentRate,
      bestDay,
      weakDay,
    };
  }

  async studentActionPlan(studentId: string) {
    const [goals, trends] = await Promise.all([
      this.goalRepo.find({ where: { studentId, status: 'active' }, order: { createdAt: 'DESC' } }),
      this.studentPerformanceTrends(studentId),
    ]);

    const items = goals.slice(0, 2).map((g) => ({
      id: g.id,
      title: g.title,
      reason: 'This goal is still active and impacts your progress.',
      category: 'goal',
      effortMinutes: 20,
      routeName: '/student/goals',
      routeArgs: null,
      done: false,
    }));

    if (trends.subjects.length) {
      const weak = [...trends.subjects]
        .sort(
          (a, b) =>
            (a.points[a.points.length - 1]?.value ?? 0) -
            (b.points[b.points.length - 1]?.value ?? 0),
        )[0];
      items.push({
        id: `study-${weak.subjectId}`,
        title: `Review ${weak.subjectName}`,
        reason: 'This is your lowest-performing subject right now.',
        category: 'study',
        effortMinutes: 30,
        routeName: '/student/grades',
        routeArgs: null,
        done: false,
      });
    }

    if (!items.length) {
      items.push({
        id: 'refresh-learning-routine',
        title: 'Plan your next study block',
        reason: 'Keep consistency by scheduling at least one focused session today.',
        category: 'routine',
        effortMinutes: 20,
        routeName: '/student/goals',
        routeArgs: null,
        done: false,
      });
    }

    return items;
  }

  private async activeClassOfferingIds(studentId: string): Promise<string[]> {
    const rows = await this.enrRepo.find({
      where: { studentId, status: 'active' },
      select: ['classOfferingId'],
    });
    return [...new Set(rows.map((r) => r.classOfferingId))];
  }

  private async classNameMap(classOfferingIds: string[]) {
    if (!classOfferingIds.length) return new Map<string, string>();
    const cos = await this.coRepo.find({
      where: { id: In(classOfferingIds) },
    });
    const map = new Map<string, string>();
    for (const c of cos) {
      map.set(c.id, c.name ?? c.id);
    }
    return map;
  }

  private async fetchAttendanceMarks(studentId: string) {
    const rows = await this.markRepo
      .createQueryBuilder('m')
      .innerJoin(AttendanceSession, 's', 's.id = m.session_id')
      .select(['m.status as status', 's.date as sessionDate'])
      .where('m.student_id = :sid', { sid: studentId })
      .orderBy('s.date', 'ASC')
      .getRawMany<{ status: string; sessionDate: string }>();
    return rows;
  }

  private presentRate(rows: Array<{ status: string }>) {
    if (!rows.length) return 0;
    const ok = rows.filter((r) => r.status === 'present' || r.status === 'late').length;
    return ok / rows.length;
  }

  private dayName(day: number | undefined) {
    switch (day) {
      case 1:
        return 'Monday';
      case 2:
        return 'Tuesday';
      case 3:
        return 'Wednesday';
      case 4:
        return 'Thursday';
      case 5:
        return 'Friday';
      case 6:
        return 'Saturday';
      case 0:
        return 'Sunday';
      default:
        return 'N/A';
    }
  }
}
