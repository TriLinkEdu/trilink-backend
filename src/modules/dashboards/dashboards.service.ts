import { Injectable } from '@nestjs/common';
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

  async teacher(userId: string) {
    const myClasses = await this.classes.count({ where: { teacherId: userId } });

    const studentsRaw = await this.enr
      .createQueryBuilder('e')
      .innerJoin('class_offerings', 'co', 'co.id = e.class_offering_id')
      .where('co.teacher_id = :uid', { uid: userId })
      .andWhere('e.status = :status', { status: 'active' })
      .select('COUNT(DISTINCT e.student_id)', 'count')
      .getRawOne();
    const totalStudents = parseInt(studentsRaw?.count || '0', 10);

    const publishedExams = await this.exams.count({ where: { createdById: userId, published: true } });
    const recentAnnouncements = await this.announcements.count({ where: { authorId: userId } });

    const pendingGrade = await this.attempts
      .createQueryBuilder('a')
      .innerJoin('exams', 'e', 'e.id = a.exam_id')
      .where('a.submitted_at IS NOT NULL')
      .andWhere('a.score IS NULL')
      .andWhere('e.created_by_id = :uid', { uid: userId })
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
    let presentLike = 0;
    for (const stat of attStats) {
      const c = parseInt(stat.count, 10);
      byStatus[stat.status] = c;
      totalAtt += c;
      if (stat.status === 'present' || stat.status === 'late') presentLike += c;
    }
    const attendanceSummaryLast30Days = {
      totalMarks: totalAtt,
      byStatus,
      presentOrLateRate: totalAtt > 0 ? Math.round((presentLike / totalAtt) * 1000) / 1000 : null,
    };

    const enrollRows = await this.enr.find({ where: { studentId: userId, status: 'active' } });
    const coIds = enrollRows.map((e) => e.classOfferingId);
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
}
