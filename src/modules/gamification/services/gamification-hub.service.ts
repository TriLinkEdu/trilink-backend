import { Injectable } from '@nestjs/common';
import { GamificationService } from '../gamification.service';
import { TeamChallengeService } from './team-challenge.service';
import { User } from '../../users/entities/user.entity';

/**
 * GamificationHubService — BFF (Backend for Frontend) aggregator.
 *
 * The mobile Gamification Hub previously triggered 10 concurrent HTTP
 * requests from the client (streak, achievements, leaderboard, quizzes,
 * missions, team challenge, XP progress, badge progress, badges, student badges).
 *
 * This service assembles the entire Hub payload in a single backend call,
 * using concurrent `Promise.all` over local function calls (which are cheap —
 * no network hop, no serialization overhead).
 *
 * Mobile clients call: GET /gamification/hub
 * Latency target: < 300ms p95
 */
@Injectable()
export class GamificationHubService {
  constructor(
    private readonly gam: GamificationService,
    private readonly teamChallenge: TeamChallengeService,
  ) {}

  async getHub(user: User): Promise<Record<string, unknown>> {
    const userId = user.id;

    const [
      streak,
      achievements,
      leaderboardResult,
      availableQuizzes,
      dailyMissions,
      teamChallenge,
      xpProfile,
      nextBadge,
      badges,
      studentBadges,
    ] = await Promise.all([
      this.safe('streak', this.gam.getLoginStreak(userId), {
        userId,
        currentStreak: 0,
        longestStreak: 0,
        lastLoginDate: null,
      }),
      this.safe('achievements', this.gam.listAchievementsForUser(userId), []),
      this.safe(
        'leaderboard',
        this.gam.leaderboardByBadgePoints('weekly', 50, user.grade ?? undefined, undefined),
        { entries: [] },
      ),
      this.safe('availableQuizzes', this.gam.listQuizzesForStudent(user), []),
      this.safe('dailyMissions', this.gam.listDailyMissions(userId), []),
      this.safe('teamChallenge', this.teamChallenge.getForStudent(userId), null),
      this.safe('xpProgress', this.gam.getMyProgress(userId), {
        userId,
        currentStreak: 0,
        longestStreak: 0,
        totalXp: 0,
        level: 1,
        levelTitle: 'Starter',
        lastLoginDate: null,
        xpIntoCurrentLevel: 0,
        xpNeededForNextLevel: 100,
        weeklyXpEarned: 0,
        weeklyXpTarget: 300,
      }),
      this.safe('nextBadgeProgress', this.gam.nextBadgeProgressForUser(userId), null),
      this.safe('badges', this.gam.listBadges(), []),
      this.safe('studentBadges', this.gam.listUserBadges(userId), []),
    ]);

    return {
      userId,
      streak,
      achievements,
      // Wrap in { entries: [...] } so the mobile repo reads lbRaw['entries'] correctly
      leaderboard: {
        period : 'weekly',
        entries: (leaderboardResult as any)?.entries ?? [],
      },
      availableQuizzes,
      dailyMissions,
      teamChallenge,
      xpProgress: {
        totalXp              : xpProfile.totalXp              ?? 0,
        level                : xpProfile.level               ?? 1,
        levelTitle           : this.levelTitle(xpProfile.level ?? 1),
        xpIntoCurrentLevel   : xpProfile.xpIntoCurrentLevel  ?? 0,
        xpNeededForNextLevel : xpProfile.xpNeededForNextLevel ?? 100,
        weeklyXpEarned       : xpProfile.weeklyXpEarned       ?? 0,
        weeklyXpTarget       : xpProfile.weeklyXpTarget       ?? 300,
      },
      nextBadgeProgress : nextBadge,
      badges,
      studentBadges,
    };
  }

  private async safe<T>(label: string, task: Promise<T>, fallback: T): Promise<T> {
    try {
      return await task;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error(`[GamificationHub] ${label} failed: ${message}`);
      return fallback;
    }
  }

  private levelTitle(level: number): string {
    if (level >= 20) return 'Legend';
    if (level >= 15) return 'Master';
    if (level >= 10) return 'Scholar';
    if (level >= 5)  return 'Learner';
    return 'Starter';
  }
}
