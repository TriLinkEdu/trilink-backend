import { Injectable, Logger } from '@nestjs/common';
import { EventEmitter2, OnEvent } from '@nestjs/event-emitter';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { GamificationProfile } from '../entities/gamification-profile.entity';
import { Achievement } from '../entities/achievement.entity';
import { UserAchievement } from '../entities/user-achievement.entity';
import { LoginStreak } from '../entities/login-streak.entity';
import { UserBadge } from '../entities/user-badge.entity';
import { ExamAttempt } from '../../exams/entities/exam-attempt.entity';
import { XpEarnedEvent, GAMIFICATION_EVENTS } from '../events/gamification.events';

/**
 * AchievementEngine — listens to domain events and unlocks achievements asynchronously.
 *
 * Previously this logic was embedded inside completeMission, submitQuizForStudent,
 * and recordLogin — all inside the monolithic GamificationService.
 * Now it runs entirely out-of-band, triggered by events.
 */
@Injectable()
export class AchievementEngine {
  private readonly logger = new Logger(AchievementEngine.name);

  constructor(
    @InjectRepository(GamificationProfile)
    private readonly profileRepo: Repository<GamificationProfile>,
    @InjectRepository(Achievement)
    private readonly achievementRepo: Repository<Achievement>,
    @InjectRepository(UserAchievement)
    private readonly userAchievementRepo: Repository<UserAchievement>,
    @InjectRepository(LoginStreak)
    private readonly streakRepo: Repository<LoginStreak>,
    @InjectRepository(UserBadge)
    private readonly ubRepo: Repository<UserBadge>,
    @InjectRepository(ExamAttempt)
    private readonly attRepo: Repository<ExamAttempt>,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  /**
   * Triggered every time XP is awarded anywhere in the system.
   * Checks all achievement thresholds and unlocks any that are newly met.
   */
  @OnEvent(GAMIFICATION_EVENTS.XP_EARNED)
  async onXpEarned(event: XpEarnedEvent): Promise<void> {
    try {
      await this.checkAndUnlock(event.userId);
    } catch (err) {
      this.logger.error(`Achievement check failed for user ${event.userId}: ${err}`);
    }
  }

  async checkAndUnlock(userId: string): Promise<UserAchievement[]> {
    const all = await this.achievementRepo.find();
    const alreadyUnlocked = await this.userAchievementRepo.find({ where: { userId } });
    const unlockedIds = new Set(alreadyUnlocked.map((ua) => ua.achievementId));

    const profile  = await this.profileRepo.findOne({ where: { userId } });
    const streak   = await this.streakRepo.findOne({ where: { userId } });
    const badgeCount = await this.ubRepo.count({ where: { userId } });
    const examCount  = await this.attRepo.count({ where: { studentId: userId } });

    const newlyUnlocked: UserAchievement[] = [];

    for (const ach of all) {
      if (unlockedIds.has(ach.id)) continue;
      if (await this.meetsCondition(ach, { profile, streak, badgeCount, examCount })) {
        const ua = this.userAchievementRepo.create({ userId, achievementId: ach.id });
        const saved = await this.userAchievementRepo.save(ua);
        newlyUnlocked.push(saved);
      }
    }

    if (newlyUnlocked.length > 0) {
      this.eventEmitter.emit(GAMIFICATION_EVENTS.ACHIEVEMENTS_UNLOCKED, {
        userId,
        achievementIds: newlyUnlocked.map((ua) => ua.achievementId),
      });
    }

    return newlyUnlocked;
  }

  private async meetsCondition(
    ach: Achievement,
    ctx: {
      profile: GamificationProfile | null;
      streak: LoginStreak | null;
      badgeCount: number;
      examCount: number;
    },
  ): Promise<boolean> {
    const { profile, streak, badgeCount, examCount } = ctx;
    const totalXp = profile?.totalXp ?? 0;
    const currentStreak = streak?.currentStreak ?? 0;
    const condition = ach.unlockCondition as { type?: string; value?: number };
    const target = condition?.value ?? 1;

    switch (condition?.type) {
      case 'login_count':
        return (streak ? 1 : 0) >= target;
      case 'streak':
        return currentStreak >= target;
      case 'badge_count':
        return badgeCount >= target;
      case 'points':
        return totalXp >= target;
      case 'exam_count':
        return examCount >= target;
      case 'perfect_exam':
        return examCount > 0;
      default:
        return false;
    }
  }
}
