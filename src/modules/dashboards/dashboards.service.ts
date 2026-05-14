import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Not, Repository } from 'typeorm';
import { User, UserRole } from '../users/entities/user.entity';
import { ClassOffering } from '../class-offerings/entities/class-offering.entity';
import { Enrollment } from '../enrollments/entities/enrollment.entity';
import { Notification } from '../notifications/entities/notification.entity';
import { ExamAttempt } from '../exams/entities/exam-attempt.entity';
import { Exam } from '../exams/entities/exam.entity';
import { AttendanceSession } from '../attendance/entities/attendance-session.entity';
import { AttendanceMark } from '../attendance/entities/attendance-mark.entity';
import { Announcement } from '../announcements/entities/announcement.entity';
import { ParentStudent } from '../parent-students/entities/parent-student.entity';
import { Feedback } from '../feedback/entities/feedback.entity';
import { GradeEntry } from '../grades/entities/grade-entry.entity';
import { Subject } from '../school-structure/entities/subject.entity';
import { Assignment } from '../assignments/entities/assignment.entity';
import { AssignmentSubmission } from '../assignments/entities/assignment-submission.entity';

@Injectable()
export class DashboardsService {
  constructor(
    @InjectRepository(User) private readonly users: Repository<User>,
    @InjectRepository(ClassOffering) private readonly classes: Repository<ClassOffering>,
    @InjectRepository(Enrollment) private readonly enr: Repository<Enrollment>,
    @InjectRepository(Notification) private readonly notif: Repository<Notification>,
    @InjectRepository(ExamAttempt) private readonly attempts: Repository<ExamAttempt>,
    @InjectRepository(Exam) private readonly exams: Repository<Exam>,
    @InjectRepository(AttendanceSession) private readonly attSessions: Repository<AttendanceSession>,
    @InjectRepository(AttendanceMark) private readonly attMarks: Repository<AttendanceMark>,
    @InjectRepository(Announcement) private readonly announcements: Repository<Announcement>,
    @InjectRepository(ParentStudent) private readonly ps: Repository<ParentStudent>,
    @InjectRepository(Feedback) private readonly feedback: Repository<Feedback>,
    @InjectRepository(GradeEntry) private readonly gradeEntries: Repository<GradeEntry>,
    @InjectRepository(Subject) private readonly subjects: Repository<Subject>,
    @InjectRepository(Assignment) private readonly assignments: Repository<Assignment>,
    @InjectRepository(AssignmentSubmission) private readonly submissions: Repository<AssignmentSubmission>,
  ) {}

  async admin() {
    const [admin, teacher, student, parent] = await Promise.all([
      this.users.count({ where: { role: UserRole.ADMIN } }),
      this.users.count({ where: { role: UserRole.TEACHER } }),
      this.users.count({ where: { role: UserRole.STUDENT } }),
      this.users.count({ where: { role: UserRole.PARENT } }),
    ]);
    const classes = await this.classes.count();
    const enrollments = await this.enr.count();

    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const dateStr = thirtyDaysAgo.toISOString().split('T')[0];

    const attStats = await this.attMarks
      .createQueryBuilder('m')
      .innerJoin('attendance_sessions', 's', 's.id = m.session_id')
      .where('s.date >= :date', { date: dateStr })
      .select('m.status', 'status')
      .addSelect('COUNT(*)', 'count')
      .groupBy('m.status')
      .getRawMany();
    let presentCount = 0;
    let totalAttMarks = 0;
    for (const stat of attStats) {
      const c = parseInt(stat.count, 10);
      if (stat.status === 'present') presentCount += c;
      totalAttMarks += c;
    }
    const schoolAttendanceRate = totalAttMarks > 0 ? presentCount / totalAttMarks : null;

    const publishedExamsCount = await this.exams.count({ where: { published: true } });
    const totalAttempts = await this.attempts.count();
    const scoreAgg = await this.attempts
      .createQueryBuilder('a')
      .where('a.released_at IS NOT NULL')
      .andWhere('a.score IS NOT NULL')
      .select('AVG(a.score)', 'avg')
      .addSelect('COUNT(*)', 'cnt')
      .getRawOne();
    const avgReleasedScore = scoreAgg?.avg != null
      ? Math.round(parseFloat(scoreAgg.avg) * 100) / 100
      : null;

    const recentAnnouncements = await this.announcements.find({
      order: { createdAt: 'DESC' },
      take: 5,
    });

    const feedbackByStatus = await this.feedback
      .createQueryBuilder('f')
      .select('f.status', 'status')
      .addSelect('COUNT(*)', 'count')
      .groupBy('f.status')
      .getRawMany();
    const feedbackSummary: Record<string, number> = {};
    for (const row of feedbackByStatus) {
      feedbackSummary[row.status || 'unknown'] = parseInt(row.count, 10);
    }

    return {
      users: { admin, teacher, student, parent, total: admin + teacher + student + parent },
      classes,
      enrollments,
      schoolAttendanceRateLast30Days: schoolAttendanceRate,
      exams: { publishedCount: publishedExamsCount, totalAttempts, averageReleasedScore: avgReleasedScore },
      recentAnnouncements,
      feedbackByStatus: feedbackSummary,
    };
  }

  async teacher(userId: string, termId?: string) {
    const myClasses = await this.classes.count({ where: { teacherId: userId } });

    const studentsRaw = await this.enr
      .createQueryBuilder('e')
      .innerJoin('class_offerings', 'co', 'co.id = e.class_offering_id')
      .where('co.teacher_id = :uid', { uid: userId })
      .andWhere('e.status = :status', { status: 'active' })
      .select('COUNT(DISTINCT e.student_id)', 'count')
      .getRawOne();
    const totalStudents = parseInt(studentsRaw?.count || '0', 10);

    const examCountQb = this.exams
      .createQueryBuilder('e')
      .where('e.created_by_id = :uid', { uid: userId })
      .andWhere('e.published = :pub', { pub: true });
    if (termId) examCountQb.andWhere('e.term_id = :tid', { tid: termId });
    const publishedExams = await examCountQb.getCount();

    const annCountQb = this.announcements
      .createQueryBuilder('a')
      .where('a.author_id = :uid', { uid: userId });
    if (termId) annCountQb.andWhere('(a.term_id IS NULL OR a.term_id = :tid)', { tid: termId });
    const recentAnnouncements = await annCountQb.getCount();

    const pendingGrade = await this.attempts
      .createQueryBuilder('a')
      .innerJoin('exams', 'e', 'e.id = a.exam_id')
      .where('a.submitted_at IS NOT NULL')
      .andWhere('a.score IS NULL')
      .andWhere('e.created_by_id = :uid', { uid: userId })
      .andWhere(termId ? 'e.term_id = :tid' : '1=1', termId ? { tid: termId } : {})
      .getCount();

    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const dateStr = thirtyDaysAgo.toISOString().split('T')[0];

    const attStats = await this.attMarks
      .createQueryBuilder('m')
      .innerJoin('attendance_sessions', 's', 's.id = m.session_id')
      .innerJoin('class_offerings', 'co', 'co.id = s.class_offering_id')
      .where('co.teacher_id = :uid', { uid: userId })
      .andWhere('s.date >= :date', { date: dateStr })
      .andWhere(termId ? '(s.term_id = :tid)' : '1=1', termId ? { tid: termId } : {})
      .select('m.status', 'status')
      .addSelect('COUNT(*)', 'count')
      .groupBy('m.status')
      .getRawMany();

    let presentCount = 0;
    let totalMarks = 0;
    for (const stat of attStats) {
      const c = parseInt(stat.count, 10);
      if (stat.status === 'present') presentCount += c;
      totalMarks += c;
    }
    const attendanceRate = totalMarks > 0 ? presentCount / totalMarks : null;

    const unread = await this.notif.count({ where: { userId, readAt: IsNull() } });

    return {
      myClasses,
      totalStudents,
      pendingGradingApprox: pendingGrade,
      unreadNotifications: unread,
      attendanceRate,
      publishedExams,
      recentAnnouncements,
    };
  }

  async student(userId: string) {
    const myEnrollments = await this.enr.count({ where: { studentId: userId, status: 'active' } });
    const unread = await this.notif.count({ where: { userId, readAt: IsNull() } });

    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const attFrom = thirtyDaysAgo.toISOString().split('T')[0];
    const attStats = await this.attMarks
      .createQueryBuilder('m')
      .innerJoin('attendance_sessions', 's', 's.id = m.session_id')
      .where('m.student_id = :sid', { sid: userId })
      .andWhere('s.date >= :d', { d: attFrom })
      .select('m.status', 'status')
      .addSelect('COUNT(*)', 'count')
      .groupBy('m.status')
      .getRawMany();
    const byStatus: Record<string, number> = {};
    let totalAtt = 0;
    let presentCount = 0;
    for (const stat of attStats) {
      const c = parseInt(stat.count, 10);
      byStatus[stat.status] = c;
      totalAtt += c;
      if (stat.status === 'present') presentCount += c;
    }
    const attendanceSummaryLast30Days = {
      totalMarks: totalAtt,
      byStatus,
      attendanceRate: totalAtt > 0 ? Math.round((presentCount / totalAtt) * 1000) / 10 : null,
    };

    const enrollRows = await this.enr.find({ where: { studentId: userId, status: 'active' } });
    const coIds = enrollRows.map((e) => e.classOfferingId);

    // ── Grades average across all subjects (released entries) ────────────────
    let gradesAveragePercent: number | null = null;
    if (coIds.length) {
      const offerings = await this.classes
        .createQueryBuilder('co')
        .where('co.id IN (:...ids)', { ids: coIds })
        .getMany();
      const offeringMap = new Map(offerings.map((co) => [co.id, co]));

      const releasedEntries = await this.gradeEntries
        .createQueryBuilder('g')
        .where('g.student_id = :sid', { sid: userId })
        .andWhere('g.released_at IS NOT NULL')
        .andWhere('g.score IS NOT NULL')
        .getMany();

      // Group by subject and compute per-subject average, then overall
      const subjectScores: Record<string, { sum: number; count: number }> = {};
      for (const entry of releasedEntries) {
        const co = offeringMap.get(entry.classOfferingId);
        if (!co) continue;
        const sid = co.subjectId;
        if (!subjectScores[sid]) subjectScores[sid] = { sum: 0, count: 0 };
        subjectScores[sid].sum += (entry.score! / entry.maxScore) * 100;
        subjectScores[sid].count++;
      }
      const subjectAverages = Object.values(subjectScores).map((s) => s.sum / s.count);
      if (subjectAverages.length > 0) {
        gradesAveragePercent =
          Math.round((subjectAverages.reduce((a, b) => a + b, 0) / subjectAverages.length) * 10) / 10;
      }
    }

    const now = new Date();
    const examQb = this.exams
      .createQueryBuilder('e')
      .where('e.published = :p', { p: true })
      .andWhere('e.opens_at > :now', { now })
      .orderBy('e.opens_at', 'ASC')
      .take(5);
    if (coIds.length) {
      examQb.andWhere('(e.class_offering_id IS NULL OR e.class_offering_id IN (:...co))', { co: coIds });
    } else {
      examQb.andWhere('e.class_offering_id IS NULL');
    }
    const upcomingExams = await examQb.getMany();

    const recentNotifications = await this.notif.find({
      where: { userId },
      order: { createdAt: 'DESC' },
      take: 5,
    });

    const testsTaken = await this.attempts.count({
      where: { studentId: userId, submittedAt: Not(IsNull()) },
    });

    return {
      activeEnrollments: myEnrollments,
      unreadNotifications: unread,
      attendanceSummaryLast30Days,
      gradesAveragePercent,
      upcomingExams: upcomingExams.map((e) => ({
        id: e.id,
        title: e.title,
        opensAt: e.opensAt,
        closesAt: e.closesAt,
        classOfferingId: e.classOfferingId,
      })),
      recentNotifications,
      testsTaken,
    };
  }

  async parent(userId: string) {
    const children = await this.ps.count({ where: { parentId: userId } });
    const unread = await this.notif.count({ where: { userId, readAt: IsNull() } });
    return { linkedChildren: children, unreadNotifications: unread };
  }

  /**
   * Parent: full dashboard for a specific child.
   *
   * Returns:
   *  - student basic info
   *  - grades: per-subject average % (released entries only)
   *  - overall grades average across all subjects
   *  - attendance: overall % and per-subject breakdown
   *  - upcoming: exams + assignments with status labels
   *
   * @param parentId  Pass null to skip the parent-student link check (admin use).
   */
  async parentChildDashboard(parentId: string | null, studentId: string) {
    // ── 1. Validate parent-student link ──────────────────────────────────────
    if (parentId !== null) {
      const link = await this.ps.findOne({ where: { parentId, studentId } });
      if (!link) throw new ForbiddenException('Not linked to this student');
    }

    // ── 2. Load student ───────────────────────────────────────────────────────
    const student = await this.users.findOne({ where: { id: studentId } });
    if (!student) throw new NotFoundException('Student not found');

    // ── 3. All enrollments for the student ───────────────────────────────────
    const enrollments = await this.enr.find({ where: { studentId } });
    const classIds = enrollments.map((e) => e.classOfferingId);

    // ── 4. Grades per subject (all released entries) ──────────────────────────
    const gradesBySubject: Record<
      string,
      { subjectId: string; subjectName: string; entries: { score: number; maxScore: number }[]; averagePercent: number | null }
    > = {};

    if (classIds.length) {
      const offerings = await this.classes
        .createQueryBuilder('co')
        .where('co.id IN (:...ids)', { ids: classIds })
        .getMany();

      const offeringMap = new Map(offerings.map((co) => [co.id, co]));

      const allEntries = await this.gradeEntries
        .createQueryBuilder('g')
        .where('g.student_id = :sid', { sid: studentId })
        .andWhere('g.released_at IS NOT NULL')
        .andWhere('g.class_offering_id IN (:...cids)', { cids: classIds })
        .getMany();

      for (const entry of allEntries) {
        const co = offeringMap.get(entry.classOfferingId);
        if (!co) continue;
        const subjectId = co.subjectId;
        if (!gradesBySubject[subjectId]) {
          const subject = await this.subjects.findOne({ where: { id: subjectId } });
          gradesBySubject[subjectId] = {
            subjectId,
            subjectName: subject?.name ?? 'Unknown',
            entries: [],
            averagePercent: null,
          };
        }
        if (entry.score != null) {
          gradesBySubject[subjectId].entries.push({ score: entry.score, maxScore: entry.maxScore });
        }
      }

      for (const sub of Object.values(gradesBySubject)) {
        if (sub.entries.length > 0) {
          const avg = sub.entries.reduce((sum, e) => sum + (e.score / e.maxScore) * 100, 0) / sub.entries.length;
          sub.averagePercent = Math.round(avg * 10) / 10;
        }
      }
    }

    const subjectSummaries = Object.values(gradesBySubject).map(({ subjectId, subjectName, entries, averagePercent }) => ({
      subjectId,
      subjectName,
      gradedEntries: entries.length,
      averagePercent,
    }));

    const scoredSubjects = subjectSummaries.filter((s) => s.averagePercent != null);
    const overallGradesAverage =
      scoredSubjects.length > 0
        ? Math.round((scoredSubjects.reduce((s, sub) => s + sub.averagePercent!, 0) / scoredSubjects.length) * 10) / 10
        : null;

    // ── 5. Attendance ─────────────────────────────────────────────────────────
    let attendanceOverall: {
      total: number;
      present: number;
      absent: number;
      excused: number;
      attendancePercent: number | null;
    } = { total: 0, present: 0, absent: 0, excused: 0, attendancePercent: null };

    const attendanceBySubject: Array<{
      subjectId: string;
      subjectName: string;
      total: number;
      present: number;
      absent: number;
      excused: number;
      attendancePercent: number | null;
    }> = [];

    if (classIds.length) {
      const sessions = await this.attSessions
        .createQueryBuilder('s')
        .where('s.class_offering_id IN (:...ids)', { ids: classIds })
        .getMany();

      const sessionIds = sessions.map((s) => s.id);

      if (sessionIds.length) {
        const marks = await this.attMarks
          .createQueryBuilder('m')
          .where('m.session_id IN (:...ids)', { ids: sessionIds })
          .andWhere('m.student_id = :sid', { sid: studentId })
          .getMany();

        const markBySession = new Map(marks.map((m) => [m.sessionId, m]));

        let total = 0, present = 0, absent = 0, excused = 0;
        const subjectAttMap: Record<
          string,
          { subjectId: string; subjectName: string; total: number; present: number; absent: number; excused: number }
        > = {};

        // Pre-load all class offerings to avoid N+1
        const sessionCoIds = [...new Set(sessions.map((s) => s.classOfferingId))];
        const sessionOfferings = await this.classes
          .createQueryBuilder('co')
          .where('co.id IN (:...ids)', { ids: sessionCoIds })
          .getMany();
        const sessionOfferingMap = new Map(sessionOfferings.map((co) => [co.id, co]));

        for (const session of sessions) {
          const co = sessionOfferingMap.get(session.classOfferingId);
          if (!co) continue;

          const mark = markBySession.get(session.id);
          const status = mark?.status ?? null;

          total++;
          if (status === 'present') present++;
          else if (status === 'absent') absent++;
          else if (status === 'excused') excused++;

          const subjectId = co.subjectId;
          if (!subjectAttMap[subjectId]) {
            const subject = await this.subjects.findOne({ where: { id: subjectId } });
            subjectAttMap[subjectId] = {
              subjectId,
              subjectName: subject?.name ?? 'Unknown',
              total: 0, present: 0, absent: 0, excused: 0,
            };
          }
          subjectAttMap[subjectId].total++;
          if (status === 'present') subjectAttMap[subjectId].present++;
          else if (status === 'absent') subjectAttMap[subjectId].absent++;
          else if (status === 'excused') subjectAttMap[subjectId].excused++;
        }

        attendanceOverall = {
          total,
          present,
          absent,
          excused,
          attendancePercent: total > 0 ? Math.round((present / total) * 1000) / 10 : null,
        };

        for (const sub of Object.values(subjectAttMap)) {
          attendanceBySubject.push({
            ...sub,
            attendancePercent: sub.total > 0 ? Math.round((sub.present / sub.total) * 1000) / 10 : null,
          });
        }
      }
    }

    // ── 6. Upcoming exams & assignments ──────────────────────────────────────
    const now = new Date();

    const upcomingExams: Array<{
      id: string;
      title: string;
      opensAt: Date;
      closesAt: Date;
      maxPoints: number;
      status: string;
      score: number | null;
      classOfferingId: string | null;
    }> = [];

    const upcomingAssignments: Array<{
      id: string;
      title: string;
      deadline: Date;
      maxScore: number;
      status: string;
      score: number | null;
      classOfferingId: string;
    }> = [];

    if (classIds.length) {
      const examRows = await this.exams
        .createQueryBuilder('e')
        .where('e.class_offering_id IN (:...ids)', { ids: classIds })
        .andWhere('e.published = :pub', { pub: true })
        .andWhere('e.closes_at >= :now', { now })
        .orderBy('e.opens_at', 'ASC')
        .getMany();

      for (const exam of examRows) {
        const attempt = await this.attempts.findOne({ where: { examId: exam.id, studentId } });
        let status: string;
        if (attempt?.submittedAt) {
          status = attempt.releasedAt ? 'graded' : 'submitted';
        } else if (now >= new Date(exam.opensAt)) {
          status = 'available';
        } else {
          status = 'upcoming';
        }
        upcomingExams.push({
          id: exam.id,
          title: exam.title,
          opensAt: exam.opensAt,
          closesAt: exam.closesAt,
          maxPoints: exam.maxPoints,
          status,
          score: attempt?.score ?? null,
          classOfferingId: exam.classOfferingId ?? null,
        });
      }

      const assignmentRows = await this.assignments
        .createQueryBuilder('a')
        .where('a.class_offering_id IN (:...ids)', { ids: classIds })
        .andWhere('a.published = :pub', { pub: true })
        .andWhere('a.deadline >= :now', { now })
        .orderBy('a.deadline', 'ASC')
        .getMany();

      for (const asgn of assignmentRows) {
        const submission = await this.submissions.findOne({ where: { assignmentId: asgn.id, studentId } });
        let status: string;
        if (submission?.releasedAt) {
          status = 'graded';
        } else if (submission?.submittedAt) {
          status = 'submitted';
        } else {
          status = 'pending';
        }
        upcomingAssignments.push({
          id: asgn.id,
          title: asgn.title,
          deadline: asgn.deadline,
          maxScore: asgn.maxScore,
          status,
          score: submission?.score ?? null,
          classOfferingId: asgn.classOfferingId,
        });
      }
    }

    // ── 7. Assemble response ──────────────────────────────────────────────────
    return {
      student: {
        id: student.id,
        firstName: student.firstName,
        lastName: student.lastName,
        email: student.email,
      },
      grades: {
        overallAveragePercent: overallGradesAverage,
        bySubject: subjectSummaries,
      },
      attendance: {
        overall: attendanceOverall,
        bySubject: attendanceBySubject,
      },
      upcoming: {
        exams: upcomingExams,
        assignments: upcomingAssignments,
        summary: {
          examsTotal: upcomingExams.length,
          examsAvailable: upcomingExams.filter((e) => e.status === 'available').length,
          assignmentsTotal: upcomingAssignments.length,
          assignmentsPending: upcomingAssignments.filter((a) => a.status === 'pending').length,
        },
      },
    };
  }
}
