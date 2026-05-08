import { Injectable } from '@nestjs/common';
import { GamificationService } from '../gamification.service';
import { XpService } from './xp.service';
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
    private readonly xp: XpService,
    private readonly teamChallenge: TeamChallengeService,
  ) {}

  async getHub(user: User): Promise<Record<string, unknown>> {
    const userId = user.id;

    const [
      streak,
      achievements,
      leaderboard,
      availableQuizzes,
      dailyMissions,
      teamChallenge,
      xpProfile,
      nextBadge,
      badges,
      studentBadges,
    ] = await Promise.all([
      this.gam.getLoginStreak(userId),
      this.gam.listAchievementsForUser(userId),
      this.gam.leaderboardByBadgePoints('weekly', 50, user.grade ?? undefined, undefined),
      this.gam.listQuizzesForStudent(user),
      this.gam.listDailyMissions(userId),
      this.teamChallenge.getForStudent(userId),
      this.xp.getProfile(userId),
      this.gam.nextBadgeProgressForUser(userId),
      this.gam.listBadges(),
      this.gam.listUserBadges(userId),
    ]);

    return {
      userId,
      streak,
      achievements,
      leaderboard,
      availableQuizzes,
      dailyMissions,
      teamChallenge,
      xpProgress   : {
        totalXp               : xpProfile.totalXp,
        level                 : xpProfile.level,
        levelTitle            : this.levelTitle(xpProfile.level),
        xpIntoCurrentLevel    : xpProfile.totalXp % 100,
        xpNeededForNextLevel  : 100,
      },
      nextBadgeProgress : nextBadge,
      badges,
      studentBadges,
    };
  }

  private levelTitle(level: number): string {
    if (level >= 20) return 'Legend';
    if (level >= 15) return 'Master';
    if (level >= 10) return 'Scholar';
    if (level >= 5)  return 'Learner';
    return 'Starter';
  }
}
