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
      .orderBy('AVG(a.score)', 'DESC')
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
        return await this.streakRepo.save(
          this.streakRepo.create({
            userId,
            currentStreak: 1,
            longestStreak: 1,
            lastLoginDate: today,
          }),
        );
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
    return this.streakRepo.save(row);
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

    return {
      userId,
      currentStreak: streak.currentStreak ?? 0,
      longestStreak: streak.longestStreak ?? 0,
      totalXp,
      level,
      levelTitle: this.levelTitle(level),
      lastLoginDate: streak.lastLoginDate ?? null,
    };
  }

  private levelTitle(level: number): string {
    if (level >= 20) return 'Legend';
    if (level >= 15) return 'Master';
    if (level >= 10) return 'Scholar';
    if (level >= 5) return 'Learner';
    return 'Starter';
  }

  async leaderboardStreaks(limit = 20) {
    const take = Number.isFinite(limit) ? Math.min(Math.max(limit, 1), 100) : 20;
    const rows = await this.streakRepo.find({
      order: { currentStreak: 'DESC', longestStreak: 'DESC' },
      take,
    });
    const entries = [];
    let rank = 1;
    for (const r of rows) {
      const u = await this.userRepo.findOne({ where: { id: r.userId } });
      entries.push({
        rank: rank++,
        userId: r.userId,
        currentStreak: r.currentStreak,
        longestStreak: r.longestStreak,
        user: u
          ? { firstName: u.firstName, lastName: u.lastName, email: u.email, role: u.role }
          : null,
      });
    }
    return { metric: 'loginStreak', entries };
  }

  private isoDate(date = new Date()): string {
    return date.toISOString().slice(0, 10);
  }

  private missionTemplates() {
    return [
      {
        key: 'checkin',
        title: 'Daily Check-in',
        description: 'Log in and keep your momentum today.',
        xpReward: 20,
      },
      {
        key: 'quick_quiz',
        title: 'Complete 1 Quick Quiz',
        description: 'Finish one quick quiz in any subject.',
        xpReward: 40,
      },
      {
        key: 'streak_guard',
        title: 'Protect Your Streak',
        description: 'Complete one mission to keep your learning streak strong.',
        xpReward: 30,
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

  private async totalBadgePointsRaw(userId: string): Promise<number> {
    const rows = await this.ubRepo.find({ where: { userId } });
    let total = 0;
    for (const row of rows) {
      const badge = await this.badgeRepo.findOne({ where: { id: row.badgeId } });
      if (badge) total += badge.pointsValue;
    }
    return total;
  }

  private async badgeLeaderboardRank(userId: string): Promise<number | null> {
    const rows = await this.ubRepo
      .createQueryBuilder('ub')
      .innerJoin(Badge, 'b', 'b.id = ub.badge_id')
      .innerJoin(User, 'u', 'u.id = ub.user_id')
      .select('ub.user_id', 'userId')
      .addSelect('SUM(b.points_value)', 'points')
      .where('u.role = :role', { role: UserRole.STUDENT })
      .groupBy('ub.user_id')
      .orderBy('SUM(b.points_value)', 'DESC')
      .addOrderBy('ub.user_id', 'ASC')
      .getRawMany<{ userId: string; points: string }>();

    let rank = 1;
    for (const row of rows) {
      if (row.userId === userId) return rank;
      rank += 1;
    }
    return null;
  }

  async listDailyMissions(userId: string, day = this.isoDate()) {
    const missions = this.missionTemplates();
    const keys = missions.map((m) => this.missionBadgeKey(m.key, day));
    const badges = await this.badgeRepo.find({ where: keys.map((k) => ({ key: k })) });
    const badgeMap = new Map(badges.map((b) => [b.key, b.id]));
    const badgeIds = badges.map((b) => b.id);
    const awardedRows = badgeIds.length
      ? await this.ubRepo.find({ where: badgeIds.map((id) => ({ userId, badgeId: id })) })
      : [];
    const awardedSet = new Set(awardedRows.map((r) => r.badgeId));

    return missions.map((m) => {
      const badgeId = badgeMap.get(this.missionBadgeKey(m.key, day));
      const done = badgeId ? awardedSet.has(badgeId) : false;
      return {
        id: this.missionId(m.key, day),
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

    return {
      xpDelta: template.xpReward,
      newTotalXp: afterXp,
      leveledUp: afterLevel > beforeLevel,
      newLevel: afterLevel,
      newAchievementIds: [],
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
    const progressCurrent = completions * 20;
    const progressTarget = 1000;
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

  private fallbackQuestions(subjectName: string) {
    return [
      {
        id: `q-${subjectName.toLowerCase()}-1`,
        text: `Quick check: ${subjectName} fundamentals question 1`,
        options: ['Option A', 'Option B', 'Option C', 'Option D'],
        correctIndex: 1,
        type: 'multipleChoice',
      },
      {
        id: `q-${subjectName.toLowerCase()}-2`,
        text: `Quick check: ${subjectName} fundamentals question 2`,
        options: ['Option A', 'Option B', 'Option C', 'Option D'],
        correctIndex: 2,
        type: 'multipleChoice',
      },
      {
        id: `q-${subjectName.toLowerCase()}-3`,
        text: `Quick check: ${subjectName} fundamentals question 3`,
        options: ['Option A', 'Option B', 'Option C', 'Option D'],
        correctIndex: 0,
        type: 'multipleChoice',
      },
    ];
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
    return subjects.map((s) => ({
      id: `quiz-${s.id}`,
      title: `${s.name} Quick Quiz`,
      subjectId: s.id,
      subjectName: s.name,
      chapterId: null,
      questionCount: 5,
      xpReward: 50,
      difficulty: 'medium',
    }));
  }

  async quizByIdForStudent(user: User, quizId: string) {
    if (user.role !== UserRole.STUDENT) throw new ForbiddenException('Only students can access quizzes');
    const subjectId = quizId.replace(/^quiz-/, '');
    const subjects = await this.enrolledSubjectsForStudent(user.id);
    const subject = subjects.find((s) => s.id === subjectId);
    if (!subject) throw new NotFoundException('Quiz not found');

    const rows = await this.questionRepo.find({ where: { subjectId }, take: 5, order: { createdAt: 'DESC' } });
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
      .slice(0, 5);

    const finalQuestions = aiQuestions.length > 0
      ? aiQuestions
      : questions.length
      ? questions
      : this.fallbackQuestions(subject.name);

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
    const xpEarned = Math.round(correct * 10 + (score >= 90 ? 20 : 0));

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
        newAchievementIds: [],
        newBadgeIds: [...awardedBadges, ...missionMutation.newBadgeIds],
        leaderboardBeforeRank: beforeRank,
        leaderboardAfterRank: afterRank,
      },
    };
  }
}
