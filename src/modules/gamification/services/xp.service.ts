import { Inject, Injectable, Logger } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { GamificationProfile } from '../entities/gamification-profile.entity';
import { User } from '../../users/entities/user.entity';
import { GAMIFICATION_EVENTS, XpEarnedEvent } from '../events/gamification.events';
import { REDIS_CLIENT, RedisClient } from '../providers/redis-client.provider';

const XP_PER_LEVEL = 100;

/**
 * XpService — the single authority for awarding XP and maintaining the
 * materialized GamificationProfile.
 *
 * Every XP-earning event anywhere in the system must route through
 * `awardXp()`. This method:
 *   1. Upserts GamificationProfile with atomic SQL increment (no race conditions).
 *   2. Updates Redis Sorted Sets for leaderboards (O(log N)).
 *   3. Emits XP_EARNED so AchievementEngine checks thresholds asynchronously.
 */
@Injectable()
export class XpService {
  private readonly logger = new Logger(XpService.name);

  private static readonly ALL_KEY    = 'leaderboard:xp:all';
  private static readonly GRADE_KEY  = (g: string) => `leaderboard:xp:grade:${g}`;
  private static readonly WEEKLY_KEY = (g: string) => `leaderboard:xp:weekly:grade:${g}`;

  constructor(
    @InjectRepository(GamificationProfile)
    private readonly profileRepo: Repository<GamificationProfile>,
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    @Inject(REDIS_CLIENT)
    private readonly redis: RedisClient,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  /**
   * Award XP to a user atomically.
   *
   * Uses a PostgreSQL ON CONFLICT DO UPDATE to increment totalXp and
   * recalculate level in a single SQL round-trip — no lost updates under
   * concurrent requests.
   */
  async awardXp(
    userId : string,
    amount : number,
    source : XpEarnedEvent['source'],
    sourceId?: string,
  ): Promise<GamificationProfile> {
    if (amount <= 0) return this.ensureProfile(userId);

    await this.profileRepo.manager.query(
      `INSERT INTO gamification_profiles (user_id, total_xp, level, grade, section, created_at, updated_at)
       SELECT u.id,
              $2::int,
              GREATEST(1, FLOOR($2::float / ${XP_PER_LEVEL})::int),
              u.grade,
              u.section,
              NOW(),
              NOW()
       FROM   users u
       WHERE  u.id = $1
       ON CONFLICT (user_id) DO UPDATE
         SET total_xp   = gamification_profiles.total_xp + $2::int,
             level      = GREATEST(1, FLOOR((gamification_profiles.total_xp + $2::float) / ${XP_PER_LEVEL})::int),
             updated_at = NOW()`,
      [userId, amount],
    );

    const profile = await this.profileRepo.findOneOrFail({ where: { userId } });

    // Redis update — non-blocking; failure degrades gracefully
    try {
      await this.syncRedis(userId, profile);
    } catch (err) {
      this.logger.warn(`Redis sync skipped for ${userId}: ${err}`);
    }

    // Async achievement check
    this.eventEmitter.emit(GAMIFICATION_EVENTS.XP_EARNED, { userId, amount, source, sourceId } satisfies XpEarnedEvent);

    return profile;
  }

  async getProfile(userId: string): Promise<GamificationProfile> {
    return this.ensureProfile(userId);
  }

  // ── Leaderboard reads via Redis ────────────────────────────────────────────

  async topByXp(
    grade   : string | undefined,
    limit   : number,
    weekly  : boolean,
  ): Promise<Array<{ userId: string; score: number; rank: number }>> {
    const key = weekly
      ? XpService.WEEKLY_KEY(grade ?? 'all')
      : grade
        ? XpService.GRADE_KEY(grade)
        : XpService.ALL_KEY;

    try {
      const raw = await this.redis.zRangeByScoreWithScores(key, '-inf', '+inf', { LIMIT: { offset: 0, count: limit } });
      // zRangeByScore returns ascending — reverse for descending rank
      const sorted = [...raw].sort((a, b) => b.score - a.score);
      return sorted.map((entry, i) => ({
        userId : entry.value,
        score  : entry.score,
        rank   : i + 1,
      }));
    } catch {
      return [];
    }
  }

  async userRank(userId: string, grade?: string): Promise<number | null> {
    const key = grade ? XpService.GRADE_KEY(grade) : XpService.ALL_KEY;
    try {
      const rank = await this.redis.zRevRank(key, userId);
      return rank !== null ? rank + 1 : null;
    } catch {
      return null;
    }
  }

  /** Called by cron every Monday midnight. */
  async resetWeeklyLeaderboards(): Promise<void> {
    try {
      const keys = await this.redis.keys('leaderboard:xp:weekly:*');
      if (keys.length) await this.redis.del(keys);
      this.logger.log(`Reset ${keys.length} weekly leaderboard key(s)`);
    } catch (err) {
      this.logger.warn(`Weekly reset failed: ${err}`);
    }
  }

  // ── Internals ─────────────────────────────────────────────────────────────

  private async ensureProfile(userId: string): Promise<GamificationProfile> {
    let profile = await this.profileRepo.findOne({ where: { userId } });
    if (!profile) {
      const user = await this.userRepo.findOne({ where: { id: userId } });
      profile = await this.profileRepo.save(
        this.profileRepo.create({
          userId,
          totalXp  : 0,
          level    : 1,
          grade    : user?.grade ?? null,
          section  : user?.section ?? null,
        }),
      );
    }
    return profile;
  }

  private async syncRedis(userId: string, profile: GamificationProfile): Promise<void> {
    const score = profile.totalXp;

    // Use individual commands (redis v5 doesn't batch as ioredis pipelines do)
    const ops: Promise<unknown>[] = [
      this.redis.zAdd(XpService.ALL_KEY, { score, value: userId }),
    ];
    if (profile.grade) {
      ops.push(this.redis.zAdd(XpService.GRADE_KEY(profile.grade), { score, value: userId }));
      ops.push(this.redis.zAdd(XpService.WEEKLY_KEY(profile.grade), { score, value: userId }));
    }
    await Promise.all(ops);
  }
}
