import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  OnModuleInit,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Between, IsNull, Not, Repository } from 'typeorm';
import { Badge } from './entities/badge.entity';
import { UserBadge } from './entities/user-badge.entity';
import { ExamAttempt } from '../exams/entities/exam-attempt.entity';
import { Exam } from '../exams/entities/exam.entity';
import { NotificationsService } from '../notifications/notifications.service';
import { User, UserRole } from '../users/entities/user.entity';
import { ParentStudent } from '../parent-students/entities/parent-student.entity';
import { AttendanceSession } from '../attendance/entities/attendance-session.entity';
import { AttendanceMark } from '../attendance/entities/attendance-mark.entity';

@Injectable()
export class GamificationService implements OnModuleInit {
  constructor(
    @InjectRepository(Badge) private readonly badgeRepo: Repository<Badge>,
    @InjectRepository(UserBadge) private readonly ubRepo: Repository<UserBadge>,
    @InjectRepository(ExamAttempt) private readonly attRepo: Repository<ExamAttempt>,
    @InjectRepository(User) private readonly userRepo: Repository<User>,
    @InjectRepository(ParentStudent) private readonly psRepo: Repository<ParentStudent>,
    @InjectRepository(AttendanceSession) private readonly attendanceSessRepo: Repository<AttendanceSession>,
    @InjectRepository(AttendanceMark) private readonly attendanceMarkRepo: Repository<AttendanceMark>,
    private readonly notifications: NotificationsService,
  ) {}

  private readonly defaultBadges: Array<{
    key: string;
    name: string;
    description: string | null;
    iconKey: string | null;
    pointsValue: number;
  }> = [
    {
      key: 'first_steps',
      name: 'First steps',
      description: 'Welcome — keep learning.',
      iconKey: 'star',
      pointsValue: 5,
    },
    {
      key: 'exam_hero',
      name: 'Exam hero',
      description: 'Scored 90%+ on a released exam.',
      iconKey: 'trophy',
      pointsValue: 25,
    },
    {
      key: 'perfect_attendance_week',
      name: 'Attendance star',
      description: 'Present every session in a week.',
      iconKey: 'calendar',
      pointsValue: 15,
    },
    {
      key: 'first_graded_exam',
      name: 'First result',
      description: 'Received your first released exam result.',
      iconKey: 'ribbon',
      pointsValue: 10,
    },
  ];

  async assertStudentViewer(viewer: User, studentId: string) {
    if (viewer.role === UserRole.ADMIN || viewer.role === UserRole.TEACHER) return;
    if (viewer.role === UserRole.STUDENT && viewer.id === studentId) return;
    if (viewer.role === UserRole.PARENT) {
      const link = await this.psRepo.findOne({ where: { parentId: viewer.id, studentId } });
      if (link) return;
    }
    throw new ForbiddenException('Cannot access this student');
  }

  async onModuleInit() {
    for (const def of this.defaultBadges) {
      const existing = await this.badgeRepo.findOne({ where: { key: def.key } });
      if (!existing) await this.badgeRepo.save(this.badgeRepo.create(def));
    }
  }

  /** Auto-awards from exam lifecycle (called by ExamsService). */
  /** ISO week (Mon–Sun, UTC) for this class: all past sessions in range have present/late → badge once. */
  async afterAttendanceMarksSaved(classOfferingId: string, sessionDate: string, studentIds: string[]) {
    if (!studentIds.length) return;
    const { start, end } = this.isoWeekRangeMondaySunday(sessionDate);
    const today = new Date().toISOString().slice(0, 10);
    const weekSessions = await this.attendanceSessRepo.find({
      where: { classOfferingId, date: Between(start, end) },
      order: { date: 'ASC' },
    });
    const pastSessions = weekSessions.filter((s) => s.date <= today);
    if (pastSessions.length === 0) return;
    const sessionIds = pastSessions.map((s) => s.id);
    for (const studentId of new Set(studentIds)) {
      let ok = true;
      for (const sid of sessionIds) {
        const mark = await this.attendanceMarkRepo.findOne({ where: { sessionId: sid, studentId } });
        if (!mark || (mark.status !== 'present' && mark.status !== 'late')) {
          ok = false;
          break;
        }
      }
      if (ok) await this.awardBadgeByKeyIfMissing(studentId, 'perfect_attendance_week', null);
    }
  }

  private isoWeekRangeMondaySunday(dateStr: string): { start: string; end: string } {
    const d = new Date(`${dateStr}T12:00:00.000Z`);
    const dow = d.getUTCDay();
    const toMonday = dow === 0 ? -6 : 1 - dow;
    const mon = new Date(d);
    mon.setUTCDate(d.getUTCDate() + toMonday);
    const sun = new Date(mon);
    sun.setUTCDate(mon.getUTCDate() + 6);
    const fmt = (x: Date) => x.toISOString().slice(0, 10);
    return { start: fmt(mon), end: fmt(sun) };
  }

  async handleExamReleased(attempt: ExamAttempt, exam: Exam) {
    const studentId = attempt.studentId;
    const releasedCount = await this.attRepo.count({
      where: { studentId, releasedAt: Not(IsNull()) },
    });
    if (releasedCount === 1) {
      await this.awardBadgeByKeyIfMissing(studentId, 'first_graded_exam', null);
    }
    const max = exam.maxPoints ?? 100;
    if (attempt.score != null && max > 0 && attempt.score / max >= 0.9) {
      await this.awardBadgeByKeyIfMissing(studentId, 'exam_hero', null);
    }
  }

  async awardBadgeByKeyIfMissing(userId: string, badgeKey: string, awardedById: string | null): Promise<boolean> {
    const badge = await this.badgeRepo.findOne({ where: { key: badgeKey } });
    if (!badge) return false;
    const dup = await this.ubRepo.findOne({ where: { userId, badgeId: badge.id } });
    if (dup) return false;
    await this.ubRepo.save(this.ubRepo.create({ userId, badgeId: badge.id, awardedById }));
    await this.notifications.createForUser(userId, {
      type: 'badge',
      title: 'New badge',
      body: `You earned "${badge.name}".`,
      payloadJson: JSON.stringify({ badgeId: badge.id, badgeKey: badge.key }),
    });
    return true;
  }

  listBadges() {
    return this.badgeRepo.find({ order: { name: 'ASC' } });
  }

  async createBadge(body: { key: string; name: string; description?: string; iconKey?: string; pointsValue?: number }) {
    const existing = await this.badgeRepo.findOne({ where: { key: body.key } });
    if (existing) throw new ConflictException('Badge key exists');
    return this.badgeRepo.save(
      this.badgeRepo.create({
        key: body.key,
        name: body.name,
        description: body.description ?? null,
        iconKey: body.iconKey ?? null,
        pointsValue: body.pointsValue ?? 0,
      }),
    );
  }

  async awardBadge(userId: string, badgeId: string, awardedById: string | null) {
    const badge = await this.badgeRepo.findOne({ where: { id: badgeId } });
    if (!badge) throw new NotFoundException('Badge not found');
    const dup = await this.ubRepo.findOne({ where: { userId, badgeId } });
    if (dup) throw new ConflictException('User already has this badge');
    return this.ubRepo.save(this.ubRepo.create({ userId, badgeId, awardedById }));
  }

  async listUserBadges(userId: string) {
    const rows = await this.ubRepo.find({ where: { userId }, order: { awardedAt: 'DESC' } });
    const out = [];
    for (const r of rows) {
      const b = await this.badgeRepo.findOne({ where: { id: r.badgeId } });
      out.push({ ...r, badge: b });
    }
    return out;
  }

  async leaderboardByExamAverage(academicYearId: string, limit = 20) {
    const qb = this.attRepo
      .createQueryBuilder('a')
      .innerJoin('exams', 'e', 'e.id = a.exam_id')
      .select('a.student_id', 'studentId')
      .addSelect('AVG(a.score)', 'avgScore')
      .addSelect('COUNT(*)', 'examCount')
      .where('e.academic_year_id = :yid', { yid: academicYearId })
      .andWhere('a.released_at IS NOT NULL')
      .andWhere('a.score IS NOT NULL')
      .groupBy('a.student_id')
      .orderBy('avgScore', 'DESC')
      .take(Math.min(Math.max(limit, 1), 100));

    const raw = await qb.getRawMany();
    const ranked = [];
    let rank = 1;
    for (const row of raw) {
      const u = await this.userRepo.findOne({ where: { id: row.studentId } });
      ranked.push({
        rank: rank++,
        studentId: row.studentId,
        averageScore: Math.round(parseFloat(row.avgScore) * 100) / 100,
        examsCounted: parseInt(row.examCount, 10),
        student: u
          ? { firstName: u.firstName, lastName: u.lastName, email: u.email, grade: u.grade, section: u.section }
          : null,
      });
    }
    return { academicYearId, metric: 'averageReleasedExamScore', entries: ranked };
  }

  async totalBadgePoints(userId: string) {
    const rows = await this.ubRepo.find({ where: { userId } });
    let total = 0;
    for (const r of rows) {
      const b = await this.badgeRepo.findOne({ where: { id: r.badgeId } });
      if (b) total += b.pointsValue;
    }
    return { userId, totalBadgePoints: total, badgeCount: rows.length };
  }

  async listUserBadgesForViewer(studentId: string, viewer: User) {
    await this.assertStudentViewer(viewer, studentId);
    return this.listUserBadges(studentId);
  }

  async totalBadgePointsForViewer(studentId: string, viewer: User) {
    await this.assertStudentViewer(viewer, studentId);
    return this.totalBadgePoints(studentId);
  }
}
