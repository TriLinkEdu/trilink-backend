import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  OnModuleInit,
  Inject,
} from '@nestjs/common';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Cache } from 'cache-manager';
import { InjectRepository } from '@nestjs/typeorm';
import { Between, IsNull, Like, LessThan, Not, Repository } from 'typeorm';
import { Cron, CronExpression } from '@nestjs/schedule';
import { Badge } from './entities/badge.entity';
import { UserBadge } from './entities/user-badge.entity';
import { Achievement } from './entities/achievement.entity';
import { UserAchievement } from './entities/user-achievement.entity';
import { ExamAttempt } from '../exams/entities/exam-attempt.entity';
import { Exam } from '../exams/entities/exam.entity';
import { NotificationsService } from '../notifications/notifications.service';
import { User, UserRole } from '../users/entities/user.entity';
import { ParentStudent } from '../parent-students/entities/parent-student.entity';
import { AttendanceSession } from '../attendance/entities/attendance-session.entity';
import { AttendanceMark } from '../attendance/entities/attendance-mark.entity';
import { LoginStreak } from './entities/login-streak.entity';
import { Enrollment } from '../enrollments/entities/enrollment.entity';
import { Subject } from '../school-structure/entities/subject.entity';
import { Question } from '../exams/entities/question.entity';
import { ClassOffering } from '../class-offerings/entities/class-offering.entity';
import { Topic } from '../topics/entities/topic.entity';

@Injectable()
export class GamificationService implements OnModuleInit {
  constructor(
    @InjectRepository(Badge) private readonly badgeRepo: Repository<Badge>,
    @InjectRepository(UserBadge) private readonly ubRepo: Repository<UserBadge>,
    @InjectRepository(Achievement) private readonly achievementRepo: Repository<Achievement>,
    @InjectRepository(UserAchievement) private readonly userAchievementRepo: Repository<UserAchievement>,
    @InjectRepository(ExamAttempt) private readonly attRepo: Repository<ExamAttempt>,
    @InjectRepository(User) private readonly userRepo: Repository<User>,
    @InjectRepository(ParentStudent) private readonly psRepo: Repository<ParentStudent>,
    @InjectRepository(AttendanceSession) private readonly attendanceSessRepo: Repository<AttendanceSession>,
    @InjectRepository(AttendanceMark) private readonly attendanceMarkRepo: Repository<AttendanceMark>,
    @InjectRepository(LoginStreak) private readonly streakRepo: Repository<LoginStreak>,
    @InjectRepository(Enrollment) private readonly enrollmentRepo: Repository<Enrollment>,
    @InjectRepository(ClassOffering) private readonly classOfferingRepo: Repository<ClassOffering>,
    @InjectRepository(Subject) private readonly subjectRepo: Repository<Subject>,
    @InjectRepository(Question) private readonly questionRepo: Repository<Question>,
    @InjectRepository(Topic) private readonly topicRepo: Repository<Topic>,
    private readonly notifications: NotificationsService,
    @Inject(CACHE_MANAGER) private readonly cacheManager: Cache,
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

  private readIntEnv(key: string, fallback: number): number {
    const raw = process.env[key];
    const value = raw ? parseInt(raw, 10) : NaN;
    return Number.isFinite(value) ? value : fallback;
  }

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
    await this.ensureDefaultAchievements();
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
    await this.ubRepo.save(this.ubRepo.create({ 
      userId, 
      badgeId: badge.id, 
      awardedById,
      pointsEarned: badge.pointsValue 
    }));
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
    return this.ubRepo.save(this.ubRepo.create({ 
      userId, 
      badgeId, 
      awardedById,
      pointsEarned: badge.pointsValue 
    }));
  }

  async listUserBadges(userId: string) {
    const rows = await this.ubRepo
      .createQueryBuilder('ub')
      .leftJoinAndSelect('ub.badge', 'badge')
      .where('ub.user_id = :userId', { userId })
      .orderBy('ub.awarded_at', 'DESC')
      .getMany();
    
    return rows.map(r => ({
      id: r.id,
      userId: r.userId,
      badgeId: r.badgeId,
      awardedById: r.awardedById,
      awardedAt: r.awardedAt,
      badge: r.badge,
    }));
  }

  async leaderboardByExamAverage(
    academicYearId: string, 
    limit = 20,
    grade?: string,
    section?: string,
    subjectId?: string
  ) {
    const cacheKey = `leaderboard:exam:${academicYearId}:${grade || 'all'}:${section || 'all'}:${subjectId || 'all'}:${limit}`;
    const cached = await this.cacheManager.get(cacheKey);
    if (cached) return cached;

    const qb = this.attRepo
      .createQueryBuilder('a')
      .innerJoin('exams', 'e', 'e.id = a.exam_id')
      .innerJoin('users', 'u', 'u.id = a.student_id')
      .select('a.student_id', 'studentId')
      .addSelect('AVG(a.score)', 'avgScore')
      .addSelect('COUNT(*)', 'examCount')
      .addSelect('u.first_name', 'firstName')
      .addSelect('u.last_name', 'lastName')
      .addSelect('u.email', 'email')
      .addSelect('u.grade', 'grade')
      .addSelect('u.section', 'section')
      .where('e.academic_year_id = :yid', { yid: academicYearId })
      .andWhere('a.released_at IS NOT NULL')
      .andWhere('a.score IS NOT NULL')
      .andWhere('u.role = :role', { role: 'student' });

    // Apply filters
    if (grade) {
      qb.andWhere('u.grade = :grade', { grade });
    }
    if (section) {
      qb.andWhere('u.section = :section', { section });
    }
    if (subjectId) {
      qb.andWhere('e.subject_id = :subjectId', { subjectId });
    }

    qb.groupBy('a.student_id')
      .addGroupBy('u.first_name')
      .addGroupBy('u.last_name')
      .addGroupBy('u.email')
      .addGroupBy('u.grade')
      .addGroupBy('u.section')
      .orderBy('AVG(a.score)', 'DESC')
      .take(Math.min(Math.max(limit, 1), 100));

    const raw = await qb.getRawMany();
    const ranked = raw.map((row, index) => ({
      rank: index + 1,
      studentId: row.studentId,
      averageScore: Math.round(parseFloat(row.avgScore) * 100) / 100,
      examsCounted: parseInt(row.examCount, 10),
      student: {
        firstName: row.firstName,
        lastName: row.lastName,
        email: row.email,
        grade: row.grade,
        section: row.section,
      },
    }));

    const result = { 
      academicYearId, 
      metric: 'averageReleasedExamScore', 
      filters: { grade, section, subjectId },
      entries: ranked 
    };

    await this.cacheManager.set(cacheKey, result, 300000); // 5 minutes
    return result;
  }

  async leaderboardByBadgePoints(
    period: 'weekly' | 'monthly' | 'all',
    limit = 20,
    grade?: string,
    section?: string,
  ) {
    const normalized = period === 'monthly' ? 'monthly' : period === 'all' ? 'all' : 'weekly';
    const cacheKey = `leaderboard:xp:${normalized}:${grade || 'all'}:${section || 'all'}:${limit}`;
    const cached = await this.cacheManager.get(cacheKey);
    if (cached) return cached;

    let fromDate: Date | undefined;
    const now = new Date();
    if (normalized === 'weekly') {
      fromDate = new Date(Date.UTC(
        now.getUTCFullYear(),
        now.getUTCMonth(),
        now.getUTCDate() - 6,
        0,
        0,
        0,
        0,
      ));
    } else if (normalized === 'monthly') {
      fromDate = new Date(Date.UTC(
        now.getUTCFullYear(),
        now.getUTCMonth(),
        now.getUTCDate() - 29,
        0,
        0,
        0,
        0,
      ));
    }

    const qb = this.ubRepo
      .createQueryBuilder('ub')
      .innerJoin(User, 'u', 'u.id = ub.user_id')
      .select('ub.user_id', 'userId')
      .addSelect('SUM(ub.points_earned)', 'points')
      .addSelect('u.first_name', 'firstName')
      .addSelect('u.last_name', 'lastName')
      .addSelect('u.email', 'email')
      .addSelect('u.grade', 'grade')
      .addSelect('u.section', 'section')
      .where('u.role = :role', { role: UserRole.STUDENT });

    if (fromDate) {
      qb.andWhere('ub.awarded_at >= :fromDate', { fromDate });
    }
    if (grade) {
      qb.andWhere('u.grade = :grade', { grade });
    }
    if (section) {
      qb.andWhere('u.section = :section', { section });
    }

    const take = Math.min(Math.max(limit, 1), 100);
    const rows = await qb
      .groupBy('ub.user_id')
      .addGroupBy('u.first_name')
      .addGroupBy('u.last_name')
      .addGroupBy('u.email')
      .addGroupBy('u.grade')
      .addGroupBy('u.section')
      .orderBy('SUM(ub.points_earned)', 'DESC')
      .addOrderBy('ub.user_id', 'ASC')
      .take(take)
      .getRawMany();

    const entries = rows.map((row, index) => ({
      rank: index + 1,
      userId: row.userId,
      points: Math.round(parseFloat(row.points) * 100) / 100,
      student: {
        firstName: row.firstName,
        lastName: row.lastName,
        email: row.email,
        grade: row.grade,
        section: row.section,
      },
    }));

    const result = {
      period: normalized,
      metric: 'badgePoints',
      filters: { grade, section },
      entries,
    };

    await this.cacheManager.set(cacheKey, result, 300000); // 5 minutes
    return result;
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

  private utcDateString(d: Date): string {
    return d.toISOString().slice(0, 10);
  }

  /** Call after successful password login (not refresh). */
  async recordLogin(userId: string): Promise<LoginStreak> {
    const now = new Date();
    const today = this.utcDateString(now);
    let row = await this.streakRepo.findOne({ where: { userId } });
    if (!row) {
      try {
        const created = await this.streakRepo.save(
          this.streakRepo.create({
            userId,
            currentStreak: 1,
            longestStreak: 1,
            lastLoginDate: today,
          }),
        );
        await this.checkAndUnlockAchievements(userId);
        return created;
      } catch (e: any) {
        if (e?.code === '23505') {
          row = await this.streakRepo.findOne({ where: { userId } });
          if (!row) throw e;
        } else {
          throw e;
        }
      }
    }
    if (row.lastLoginDate === today) return row;

    const y = new Date(now);
    y.setUTCDate(y.getUTCDate() - 1);
    const yesterday = this.utcDateString(y);

    if (row.lastLoginDate === yesterday) {
      row.currentStreak += 1;
    } else {
      row.currentStreak = 1;
    }
    row.lastLoginDate = today;
    row.longestStreak = Math.max(row.longestStreak, row.currentStreak);
    const saved = await this.streakRepo.save(row);
    await this.checkAndUnlockAchievements(userId);
    return saved;
  }

  async getLoginStreak(userId: string) {
    const row = await this.streakRepo.findOne({ where: { userId } });
    return {
      userId,
      currentStreak: row?.currentStreak ?? 0,
      longestStreak: row?.longestStreak ?? 0,
      lastLoginDate: row?.lastLoginDate ?? null,
    };
  }

  async getMyProgress(userId: string) {
    const [streak, points] = await Promise.all([
      this.getLoginStreak(userId),
      this.totalBadgePoints(userId),
    ]);

    const totalXp = points.totalBadgePoints ?? 0;
    const level = Math.max(1, Math.floor(totalXp / 100));
    const xpIntoCurrentLevel = totalXp % 100;
    const xpNeededForNextLevel = 100;

    const now = new Date();
    const weekStart = new Date(Date.UTC(
      now.getUTCFullYear(),
      now.getUTCMonth(),
      now.getUTCDate() - 6,
      0,
      0,
      0,
      0,
    ));
    const weeklyXpEarned = await this.totalBadgePointsRaw(userId, weekStart);
    const weeklyXpTarget = this.readIntEnv('GAMIFICATION_WEEKLY_XP_TARGET', 300);

    return {
      userId,
      currentStreak: streak.currentStreak ?? 0,
      longestStreak: streak.longestStreak ?? 0,
      totalXp,
      level,
      levelTitle: this.levelTitle(level),
      lastLoginDate: streak.lastLoginDate ?? null,
      xpIntoCurrentLevel,
      xpNeededForNextLevel,
      weeklyXpEarned,
      weeklyXpTarget,
    };
  }

  private levelTitle(level: number): string {
    if (level >= 20) return 'Legend';
    if (level >= 15) return 'Master';
    if (level >= 10) return 'Scholar';
    if (level >= 5) return 'Learner';
    return 'Starter';
  }

  async leaderboardStreaks(limit = 20, grade?: string, section?: string) {
    const cacheKey = `leaderboard:streaks:${limit}:${grade || 'all'}:${section || 'all'}`;
    const cached = await this.cacheManager.get(cacheKey);
    if (cached) return cached;

    const take = Number.isFinite(limit) ? Math.min(Math.max(limit, 1), 100) : 20;
    const qb = this.streakRepo
      .createQueryBuilder('s')
      .innerJoin(User, 'u', 'u.id = s.user_id')
      .select('s.user_id', 'userId')
      .addSelect('s.current_streak', 'currentStreak')
      .addSelect('s.longest_streak', 'longestStreak')
      .addSelect('u.first_name', 'firstName')
      .addSelect('u.last_name', 'lastName')
      .addSelect('u.email', 'email')
      .addSelect('u.role', 'role')
      .addSelect('u.grade', 'grade')
      .addSelect('u.section', 'section')
      .where('u.role = :role', { role: UserRole.STUDENT });

    if (grade) {
      qb.andWhere('u.grade = :grade', { grade });
    }
    if (section) {
      qb.andWhere('u.section = :section', { section });
    }

    const rows = await qb
      .orderBy('s.current_streak', 'DESC')
      .addOrderBy('s.longest_streak', 'DESC')
      .addOrderBy('s.user_id', 'ASC')
      .take(take)
      .getRawMany();

    const entries = rows.map((row, index) => ({
      rank: index + 1,
      userId: row.userId,
      currentStreak: parseInt(row.currentStreak, 10),
      longestStreak: parseInt(row.longestStreak, 10),
      user: {
        firstName: row.firstName,
        lastName: row.lastName,
        email: row.email,
        role: row.role,
        grade: row.grade,
        section: row.section,
      },
    }));
    const result = { metric: 'loginStreak', entries, filters: { grade, section } };
    await this.cacheManager.set(cacheKey, result, 300000); // 5 minutes
    return result;
  }

  private isoDate(date = new Date()): string {
    return date.toISOString().slice(0, 10);
  }

  private missionTemplates() {
    const checkinXp = this.readIntEnv('GAMIFICATION_MISSION_CHECKIN_XP', 20);
    const quickQuizXp = this.readIntEnv('GAMIFICATION_MISSION_QUIZ_XP', 40);
    const streakGuardXp = this.readIntEnv('GAMIFICATION_MISSION_STREAK_XP', 30);
    return [
      {
        key: 'checkin',
        title: 'Daily Check-in',
        description: 'Log in and keep your momentum today.',
        xpReward: checkinXp,
      },
      {
        key: 'quick_quiz',
        title: 'Complete 1 Quick Quiz',
        description: 'Finish one quick quiz in any subject.',
        xpReward: quickQuizXp,
      },
      {
        key: 'streak_guard',
        title: 'Protect Your Streak',
        description: 'Complete one mission to keep your learning streak strong.',
        xpReward: streakGuardXp,
      },
    ] as const;
  }

  private missionId(key: string, day: string) {
    return `${key}:${day}`;
  }

  private missionBadgeKey(key: string, day: string) {
    return `mission_${key}_${day}`;
  }

  private parseMissionId(id: string): { key: string; day: string } {
    const [key, day] = id.split(':');
    if (!key || !day || !/^\d{4}-\d{2}-\d{2}$/.test(day)) {
      throw new NotFoundException('Mission not found');
    }
    return { key, day };
  }

  private levelFromXp(totalXp: number) {
    return Math.max(1, Math.floor(totalXp / 100));
  }

  private async totalBadgePointsRaw(userId: string, fromDate?: Date): Promise<number> {
    const qb = this.ubRepo
      .createQueryBuilder('ub')
      .select('COALESCE(SUM(ub.points_earned), 0)', 'total')
      .where('ub.user_id = :userId', { userId });
    if (fromDate) {
      qb.andWhere('ub.awarded_at >= :fromDate', { fromDate });
    }
    const result = await qb.getRawOne();
    return parseInt(result?.total || '0', 10);
  }

  private async badgeLeaderboardRank(userId: string): Promise<number | null> {
    const user = await this.userRepo.findOne({ where: { id: userId } });
    if (!user) return null;

    const qb = this.ubRepo
      .createQueryBuilder('ub')
      .innerJoin(User, 'u', 'u.id = ub.user_id')
      .select('ub.user_id', 'userId')
      .addSelect('SUM(ub.points_earned)', 'points')
      .where('u.role = :role', { role: UserRole.STUDENT });

    if (user.grade) {
      qb.andWhere('u.grade = :grade', { grade: user.grade });
    }

    const rows = await qb
      .groupBy('ub.user_id')
      .orderBy('SUM(ub.points_earned)', 'DESC')
      .addOrderBy('ub.user_id', 'ASC')
      .getRawMany();

    let rank = 1;
    for (const row of rows) {
      if (row.userId === userId) return rank;
      rank += 1;
    }
    return null;
  }

  async listDailyMissions(userId: string, day?: string) {
    const actualDay = day || this.isoDate();
    const missions = this.missionTemplates();
    const keys = missions.map((m) => this.missionBadgeKey(m.key, actualDay));
    const badges = await this.badgeRepo.find({ where: keys.map((k) => ({ key: k })) });
    const badgeMap = new Map(badges.map((b) => [b.key, b.id]));
    const badgeIds = badges.map((b) => b.id);
    const awardedRows = badgeIds.length
      ? await this.ubRepo.find({ where: badgeIds.map((id) => ({ userId, badgeId: id })) })
      : [];
    const awardedSet = new Set(awardedRows.map((r) => r.badgeId));

    return missions.map((m) => {
      const badgeId = badgeMap.get(this.missionBadgeKey(m.key, actualDay));
      const done = badgeId ? awardedSet.has(badgeId) : false;
      return {
        id: this.missionId(m.key, actualDay),
        title: m.title,
        description: m.description,
        xpReward: m.xpReward,
        isCompleted: done,
        progressCurrent: done ? 1 : 0,
        progressTarget: 1,
      };
    });
  }

  async completeMission(userId: string, missionId: string) {
    const { key, day } = this.parseMissionId(missionId);
    const template = this.missionTemplates().find((m) => m.key == key);
    if (!template) throw new NotFoundException('Mission not found');

    const badgeKey = this.missionBadgeKey(key, day);
    let badge = await this.badgeRepo.findOne({ where: { key: badgeKey } });
    if (!badge) {
      badge = await this.badgeRepo.save(
        this.badgeRepo.create({
          key: badgeKey,
          name: `${template.title} (${day})`,
          description: template.description,
          iconKey: 'target',
          pointsValue: template.xpReward,
        }),
      );
    }

    const already = await this.ubRepo.findOne({ where: { userId, badgeId: badge.id } });
    if (already) {
      const total = await this.totalBadgePointsRaw(userId);
      return {
        xpDelta: 0,
        newTotalXp: total,
        leveledUp: false,
        newLevel: this.levelFromXp(total),
        newAchievementIds: [],
        newBadgeIds: [],
        leaderboardBeforeRank: await this.badgeLeaderboardRank(userId),
        leaderboardAfterRank: await this.badgeLeaderboardRank(userId),
      };
    }

    const beforeXp = await this.totalBadgePointsRaw(userId);
    const beforeLevel = this.levelFromXp(beforeXp);
    const beforeRank = await this.badgeLeaderboardRank(userId);

    await this.ubRepo.save(this.ubRepo.create({ userId, badgeId: badge.id, awardedById: null }));

    const afterXp = beforeXp + template.xpReward;
    const afterLevel = this.levelFromXp(afterXp);
    const afterRank = await this.badgeLeaderboardRank(userId);

    const newlyUnlocked = await this.checkAndUnlockAchievements(userId);
    const newAchievementIds = newlyUnlocked.map((a) => a.id);

    return {
      xpDelta: template.xpReward,
      newTotalXp: afterXp,
      leveledUp: afterLevel > beforeLevel,
      newLevel: afterLevel,
      newAchievementIds,
      newBadgeIds: [badge.id],
      leaderboardBeforeRank: beforeRank,
      leaderboardAfterRank: afterRank,
    };
  }

  async teamChallenge(userId: string) {
    const today = new Date();
    const end = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate() + (7 - today.getUTCDay())));
    const weekTag = today.toISOString().slice(0, 8);
    const rows = await this.badgeRepo
      .createQueryBuilder('b')
      .innerJoin(UserBadge, 'ub', 'ub.badge_id = b.id')
      .where('b.key LIKE :prefix', { prefix: `mission_%_${weekTag}%` })
      .select('COUNT(*)', 'count')
      .getRawOne<{ count: string }>();
    const completions = parseInt(rows?.count || '0', 10);
    const xpPerMission = this.readIntEnv('GAMIFICATION_TEAM_XP_PER_MISSION', 20);
    const progressCurrent = completions * xpPerMission;
    const progressTarget = this.readIntEnv('GAMIFICATION_TEAM_TARGET_XP', 1000);
    return {
      id: `team-week-${weekTag.replace('-', '')}`,
      title: 'Weekly Class Sprint',
      objective: 'Complete daily missions together this week.',
      progressCurrent,
      progressTarget,
      contributorCount: Math.max(1, Math.floor(completions / 2)),
      endsAt: end.toISOString(),
      isJoined: true,
      myContributionXp: await this.totalBadgePointsRaw(userId),
    };
  }

  private async enrolledSubjectsForStudent(studentId: string) {
    const rows = await this.enrollmentRepo.find({ where: { studentId, status: 'active' } });
    const ids = [...new Set(rows.map((r) => r.classOfferingId))];
    if (!ids.length) return [] as Subject[];
    const classes = await this.classOfferingRepo.find({ where: ids.map((id) => ({ id })) });
    const subjectIds = [...new Set(classes.map((c) => c.subjectId).filter(Boolean))];
    if (!subjectIds.length) return [] as Subject[];
    return this.subjectRepo.find({ where: subjectIds.map((id) => ({ id })) });
  }

  private async aiQuestionCandidatesForSubject(userId: string, subjectId: string) {
    const topicRows = await this.topicRepo.find({
      where: { subjectId },
      order: { orderIndex: 'ASC', createdAt: 'ASC' },
      take: 6,
    });
    if (!topicRows.length) return [] as Array<Record<string, unknown>>;

    const aiBase = (process.env.AI_SERVICE_URL || '').trim().replace(/\/$/, '');
    if (!aiBase) return [] as Array<Record<string, unknown>>;

    const key = (process.env.INTERNAL_API_KEY || '').trim();
    const out: Array<Record<string, unknown>> = [];

    for (const topic of topicRows) {
      try {
        const params = new URLSearchParams({ limit: '5', difficulty: 'medium' });
        const res = await fetch(`${aiBase}/api/ai/content/questions/${topic.id}?${params.toString()}`, {
          method: 'GET',
          headers: {
            ...(key ? { 'X-API-Key': key } : {}),
          },
        });
        if (!res.ok) continue;
        const body = (await res.json()) as Record<string, unknown>;
        const questions = (body['questions'] as Array<Record<string, unknown>> | undefined) || [];
        for (const q of questions) {
          out.push({ ...q, topicId: topic.id, topicName: topic.name });
        }
      } catch (_) {
        // ignore AI failures; caller falls back to local bank.
      }
    }

    return out;
  }

  private normalizeAiQuestion(
    raw: Record<string, unknown>,
    index: number,
  ): { id: string; text: string; options: string[]; correctIndex: number; type: string; pointValue: number } | null {
    const id = String(raw['id'] ?? raw['question_id'] ?? `ai-q-${index + 1}`);
    const text = String(raw['stem'] ?? raw['text'] ?? raw['question'] ?? '').trim();
    if (!text) return null;

    let options: string[] = [];
    const optionsRaw = raw['options'];
    if (Array.isArray(optionsRaw)) {
      options = optionsRaw
        .map((o) => {
          if (typeof o === 'string') return o;
          if (o && typeof o === 'object') {
            const t = (o as Record<string, unknown>)['text'];
            const l = (o as Record<string, unknown>)['label'];
            return String(t ?? l ?? '').trim();
          }
          return String(o);
        })
        .filter((o) => o.length > 0);
    }

    if (options.length < 2) {
      return null;
    }

    let correctIndex = 0;
    const answerKey = raw['answer_key'] ?? raw['answerKey'] ?? raw['correctIndex'];
    if (typeof answerKey === 'number') {
      correctIndex = Math.trunc(answerKey);
    } else if (typeof answerKey === 'string') {
      const parsed = Number.parseInt(answerKey.trim(), 10);
      if (Number.isFinite(parsed)) {
        correctIndex = parsed;
      } else {
        const normalized = answerKey.trim().toLowerCase();
        const match = options.findIndex((o) => o.trim().toLowerCase() === normalized);
        if (match >= 0) correctIndex = match;
      }
    }
    if (correctIndex < 0 || correctIndex >= options.length) {
      correctIndex = 0;
    }

    return {
      'id': id,
      'text': text,
      'options': options,
      'correctIndex': correctIndex,
      'type': 'multipleChoice',
      'pointValue': 1,
    };
  }

  async listQuizzesForStudent(user: User) {
    if (user.role !== UserRole.STUDENT) return [];
    const subjects = await this.enrolledSubjectsForStudent(user.id);
    const questionCount = this.readIntEnv('GAMIFICATION_QUIZ_QUESTION_COUNT', 5);
    const xpReward = this.readIntEnv('GAMIFICATION_QUIZ_REWARD', 50);
    return subjects.map((s) => ({
      id: `quiz-${s.id}`,
      title: `${s.name} Quick Quiz`,
      subjectId: s.id,
      subjectName: s.name,
      chapterId: null,
      questionCount,
      xpReward,
      difficulty: 'medium',
    }));
  }

  async quizByIdForStudent(user: User, quizId: string) {
    if (user.role !== UserRole.STUDENT) throw new ForbiddenException('Only students can access quizzes');
    const subjectId = quizId.replace(/^quiz-/, '');
    const subjects = await this.enrolledSubjectsForStudent(user.id);
    const subject = subjects.find((s) => s.id === subjectId);
    if (!subject) throw new NotFoundException('Quiz not found');

    const questionLimit = this.readIntEnv('GAMIFICATION_QUIZ_QUESTION_COUNT', 5);
    const rows = await this.questionRepo.find({
      where: { subjectId },
      take: questionLimit,
      order: { createdAt: 'DESC' },
    });
    const questions = rows
      .map((q) => {
        try {
          const options = JSON.parse(q.optionsJson || '[]');
          const answer = parseInt(q.answerKey || '', 10);
          if (!Array.isArray(options) || options.length < 2 || !Number.isFinite(answer)) return null;
          return {
            id: q.id,
            text: q.stem,
            options: options.map((o: unknown) => String(o)),
            correctIndex: answer,
            type: 'multipleChoice',
            pointValue: 1,
          };
        } catch (_) {
          return null;
        }
      })
      .filter((q): q is NonNullable<typeof q> => q !== null);

    const aiCandidatesRaw = await this.aiQuestionCandidatesForSubject(user.id, subjectId);
    const aiQuestions = aiCandidatesRaw
      .map((q, i) => this.normalizeAiQuestion(q, i))
      .filter((q): q is NonNullable<typeof q> => q !== null)
      .slice(0, questionLimit);

    const finalQuestions = aiQuestions.length > 0
      ? aiQuestions
      : questions.length
      ? questions
      : [];

    if (finalQuestions.length === 0) {
      throw new NotFoundException('No questions available for this subject yet');
    }

    return {
      id: quizId,
      title: `${subject.name} Quick Quiz`,
      subjectId: subject.id,
      subjectName: subject.name,
      durationMinutes: 10,
      questions: finalQuestions,
      isCompleted: false,
      lifecycleState: 'published',
      isTimeLimited: true,
    };
  }

  async submitQuizForStudent(
    user: User,
    quizId: string,
    answers: Record<string, number>,
  ) {
    const quiz = await this.quizByIdForStudent(user, quizId);
    let correct = 0;
    for (const q of quiz.questions) {
      if (answers[q.id] === q.correctIndex) correct += 1;
    }
    const total = quiz.questions.length;
    const score = total > 0 ? (correct / total) * 100 : 0;
    const perCorrect = this.readIntEnv('GAMIFICATION_QUIZ_POINTS_PER_CORRECT', 10);
    const bonus = this.readIntEnv('GAMIFICATION_QUIZ_BONUS_90', 20);
    const xpEarned = Math.round(correct * perCorrect + (score >= 90 ? bonus : 0));

    const beforeXp = await this.totalBadgePointsRaw(user.id);
    const beforeLevel = this.levelFromXp(beforeXp);
    const beforeRank = await this.badgeLeaderboardRank(user.id);

    const badgeKey = `quiz_reward_${quizId}_${this.isoDate()}`;
    let rewardBadge = await this.badgeRepo.findOne({ where: { key: badgeKey } });
    if (!rewardBadge) {
      rewardBadge = await this.badgeRepo.save(
        this.badgeRepo.create({
          key: badgeKey,
          name: `${quiz.title} Reward (${this.isoDate()})`,
          description: `Reward for completing ${quiz.title}`,
          iconKey: 'quiz',
          pointsValue: xpEarned,
        }),
      );
    }
    const existing = await this.ubRepo.findOne({ where: { userId: user.id, badgeId: rewardBadge.id } });
    const awardedBadges: string[] = [];
    let delta = 0;
    if (!existing) {
      await this.ubRepo.save(this.ubRepo.create({ userId: user.id, badgeId: rewardBadge.id, awardedById: null }));
      awardedBadges.push(rewardBadge.id);
      delta += xpEarned;
    }

    const missionMutation = await this.completeMission(user.id, this.missionId('quick_quiz', this.isoDate()));
    delta += missionMutation.xpDelta;

    const newlyUnlocked = await this.checkAndUnlockAchievements(user.id);
    const newAchievementIds = [
      ...new Set([
        ...missionMutation.newAchievementIds,
        ...newlyUnlocked.map((a) => a.id),
      ]),
    ];

    const afterXp = beforeXp + delta;
    const afterLevel = this.levelFromXp(afterXp);
    const afterRank = await this.badgeLeaderboardRank(user.id);

    return {
      result: {
        examId: quizId,
        examTitle: quiz.title,
        totalQuestions: total,
        correctAnswers: correct,
        score,
        xpEarned: xpEarned,
        answerMap: answers,
      },
      mutation: {
        xpDelta: delta,
        newTotalXp: afterXp,
        leveledUp: afterLevel > beforeLevel,
        newLevel: afterLevel,
        newAchievementIds,
        newBadgeIds: [...awardedBadges, ...missionMutation.newBadgeIds],
        leaderboardBeforeRank: beforeRank,
        leaderboardAfterRank: afterRank,
      },
    };
  }

  @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)
  async cleanupOldBadges() {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    try {
      // Delete old mission badges
      const missionResult = await this.badgeRepo.delete({
        key: Like('mission_%'),
        createdAt: LessThan(thirtyDaysAgo),
      });

      // Delete old quiz reward badges
      const quizResult = await this.badgeRepo.delete({
        key: Like('quiz_reward_%'),
        createdAt: LessThan(thirtyDaysAgo),
      });

      const totalDeleted = (missionResult.affected || 0) + (quizResult.affected || 0);
      if (totalDeleted > 0) {
        console.log(`🧹 Badge cleanup: Deleted ${totalDeleted} old badges (${missionResult.affected || 0} missions, ${quizResult.affected || 0} quizzes)`);
      }
    } catch (error) {
      console.error('❌ Badge cleanup failed:', error);
    }
  }

  // ==================== ACHIEVEMENTS ====================

  private readonly defaultAchievements = [
    { key: 'first_login', title: 'Welcome Aboard', description: 'Log in for the first time', category: 'milestone', condition: { type: 'login_count', value: 1 } },
    { key: 'streak_3', title: '3-Day Streak', description: 'Log in for 3 consecutive days', category: 'consistency', condition: { type: 'streak', value: 3 } },
    { key: 'streak_7', title: 'Week Warrior', description: 'Log in for 7 consecutive days', category: 'consistency', condition: { type: 'streak', value: 7 } },
    { key: 'streak_30', title: 'Monthly Master', description: 'Log in for 30 consecutive days', category: 'consistency', condition: { type: 'streak', value: 30 } },
    { key: 'first_badge', title: 'Badge Collector', description: 'Earn your first badge', category: 'milestone', condition: { type: 'badge_count', value: 1 } },
    { key: 'badges_5', title: 'Badge Enthusiast', description: 'Earn 5 badges', category: 'milestone', condition: { type: 'badge_count', value: 5 } },
    { key: 'badges_10', title: 'Badge Master', description: 'Earn 10 badges', category: 'milestone', condition: { type: 'badge_count', value: 10 } },
    { key: 'points_100', title: 'Century Club', description: 'Earn 100 points', category: 'milestone', condition: { type: 'points', value: 100 } },
    { key: 'points_500', title: 'Point Powerhouse', description: 'Earn 500 points', category: 'milestone', condition: { type: 'points', value: 500 } },
    { key: 'first_exam', title: 'Test Taker', description: 'Complete your first exam', category: 'milestone', condition: { type: 'exam_count', value: 1 } },
    { key: 'exams_10', title: 'Exam Expert', description: 'Complete 10 exams', category: 'milestone', condition: { type: 'exam_count', value: 10 } },
    { key: 'perfect_score', title: 'Perfectionist', description: 'Score 100% on an exam', category: 'milestone', condition: { type: 'perfect_exam', value: 1 } },
  ];

  async ensureDefaultAchievements() {
    for (const def of this.defaultAchievements) {
      const exists = await this.achievementRepo.findOne({ where: { key: def.key } });
      if (!exists) {
        await this.achievementRepo.save({
          key: def.key,
          title: def.title,
          description: def.description,
          category: def.category as any,
          unlockCondition: def.condition,
        });
      }
    }
  }

  async listAchievements() {
    return this.achievementRepo.find({ order: { category: 'ASC', createdAt: 'ASC' } });
  }

  async listUserAchievements(userId: string) {
    return this.userAchievementRepo.find({
      where: { userId },
      relations: ['achievement'],
      order: { unlockedAt: 'DESC' },
    });
  }

  async listAchievementsForUser(userId: string) {
    const [achievements, unlocked, streakRow, badgeCount, totalPoints, examCount, perfectExam] =
      await Promise.all([
        this.achievementRepo.find({ order: { category: 'ASC', createdAt: 'ASC' } }),
        this.userAchievementRepo.find({ where: { userId } }),
        this.streakRepo.findOne({ where: { userId } }),
        this.ubRepo.count({ where: { userId } }),
        this.totalBadgePointsRaw(userId),
        this.attRepo.count({ where: { studentId: userId, releasedAt: Not(IsNull()) } }),
        this.attRepo.findOne({ where: { studentId: userId, score: 100, releasedAt: Not(IsNull()) } }),
      ]);

    const unlockedMap = new Map(unlocked.map((u) => [u.achievementId, u]));
    const loginCount = streakRow ? 1 : 0;
    const currentStreak = streakRow?.currentStreak ?? 0;

    return achievements.map((achievement) => {
      const condition = achievement.unlockCondition || {};
      const target = typeof condition.value === 'number' ? condition.value : 1;
      let current = 0;

      switch (condition.type) {
        case 'login_count':
          current = loginCount;
          break;
        case 'streak':
          current = currentStreak;
          break;
        case 'badge_count':
          current = badgeCount;
          break;
        case 'points':
          current = totalPoints;
          break;
        case 'exam_count':
          current = examCount;
          break;
        case 'perfect_exam':
          current = perfectExam ? 1 : 0;
          break;
        default:
          current = 0;
      }

      const unlockedRow = unlockedMap.get(achievement.id);
      return {
        id: achievement.id,
        title: achievement.title,
        description: achievement.description ?? '',
        iconUrl: achievement.iconUrl ?? '',
        xpValue: 0,
        isUnlocked: !!unlockedRow,
        unlockedAt: unlockedRow?.unlockedAt ?? null,
        category: achievement.category,
        progressCurrent: current,
        progressTarget: target,
      };
    });
  }

  async checkAndUnlockAchievements(userId: string) {
    const achievements = await this.achievementRepo.find();
    const unlocked = await this.userAchievementRepo.find({ where: { userId } });
    const unlockedIds = new Set(unlocked.map(u => u.achievementId));
    const newlyUnlocked: Achievement[] = [];

    for (const achievement of achievements) {
      if (unlockedIds.has(achievement.id)) continue;

      const condition = achievement.unlockCondition;
      let met = false;

      switch (condition.type) {
        case 'login_count':
          const loginCount = await this.streakRepo.count({ where: { userId } });
          met = loginCount >= condition.value;
          break;
        case 'streak':
          const streak = await this.streakRepo.findOne({ where: { userId } });
          met = !!(streak && streak.currentStreak >= condition.value);
          break;
        case 'badge_count':
          const badgeCount = await this.ubRepo.count({ where: { userId } });
          met = badgeCount >= condition.value;
          break;
        case 'points':
          const points = await this.totalBadgePointsRaw(userId);
          met = points >= condition.value;
          break;
        case 'exam_count':
          const examCount = await this.attRepo.count({ where: { studentId: userId, releasedAt: Not(IsNull()) } });
          met = examCount >= condition.value;
          break;
        case 'perfect_exam':
          const perfectExam = await this.attRepo.findOne({ where: { studentId: userId, score: 100, releasedAt: Not(IsNull()) } });
          met = !!perfectExam;
          break;
      }

      if (met) {
        await this.userAchievementRepo.save({ userId, achievementId: achievement.id });
        newlyUnlocked.push(achievement);
        await this.notifications.createForUser(userId, {
          title: `Achievement Unlocked: ${achievement.title}`,
          body: achievement.description || '',
          type: 'achievement',
        });
      }
    }

    return newlyUnlocked;
  }
}
