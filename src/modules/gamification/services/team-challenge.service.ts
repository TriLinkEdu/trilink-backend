import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Enrollment } from '../../enrollments/entities/enrollment.entity';
import { ClassOffering } from '../../class-offerings/entities/class-offering.entity';
import { GamificationProfile } from '../entities/gamification-profile.entity';
import { Badge } from '../entities/badge.entity';
import { UserBadge } from '../entities/user-badge.entity';
import { User } from '../../users/entities/user.entity';

/**
 * TeamChallengeService — real class-scoped collaborative challenge.
 *
 * Previously: a global counter that summed ALL mission completions across
 * the entire platform and divided by 2 as a fake "contributor count".
 *
 * Now: scoped to the specific ClassOffering the student is enrolled in.
 * Progress = total XP earned by students in the same class this week.
 * Target = classSize × weeklyXpTargetPerStudent (driven by env var).
 */
@Injectable()
export class TeamChallengeService {
  constructor(
    @InjectRepository(Enrollment)
    private readonly enrollmentRepo: Repository<Enrollment>,
    @InjectRepository(ClassOffering)
    private readonly classOfferingRepo: Repository<ClassOffering>,
    @InjectRepository(GamificationProfile)
    private readonly profileRepo: Repository<GamificationProfile>,
    @InjectRepository(UserBadge)
    private readonly ubRepo: Repository<UserBadge>,
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
  ) {}

  async getForStudent(userId: string) {
    // Step 1: find the student's primary active enrollment
    const enrollments = await this.enrollmentRepo.find({
      where: { studentId: userId, status: 'active' },
    });
    if (!enrollments.length) return this.fallbackChallenge();

    // Use the first enrollment's ClassOffering as the "class"
    const primaryOffering = await this.classOfferingRepo.findOne({
      where: { id: enrollments[0].classOfferingId },
    });
    if (!primaryOffering) return this.fallbackChallenge();

    // Step 2: find all students enrolled in the same class
    const classmates = await this.enrollmentRepo.find({
      where: { classOfferingId: primaryOffering.id, status: 'active' },
    });
    const classmateIds = [...new Set(classmates.map((e) => e.studentId))];
    const classSize = classmateIds.length;

    // Step 3: sum XP earned by all classmates this week
    const weekStart = this.weekStartUtc();
    const weekEnd   = this.weekEndUtc();
    const rows = await this.ubRepo
      .createQueryBuilder('ub')
      .select('ub.user_id', 'userId')
      .addSelect('SUM(ub.points_earned)', 'weeklyXp')
      .where('ub.user_id IN (:...ids)', { ids: classmateIds })
      .andWhere('ub.awarded_at >= :start', { start: weekStart })
      .andWhere('ub.awarded_at <= :end', { end: weekEnd })
      .groupBy('ub.user_id')
      .getRawMany();

    const progressCurrent = rows.reduce((sum, r) => sum + parseInt(r.weeklyXp || '0', 10), 0);
    const contributorCount = rows.length;

    // My own weekly XP
    const myRow = rows.find((r) => r.userId === userId);
    const myContributionXp = parseInt(myRow?.weeklyXp || '0', 10);

    // Target = classSize × 100 XP / week (env-configurable)
    const xpTargetPerStudent = parseInt(process.env.GAMIFICATION_TEAM_XP_PER_STUDENT ?? '100', 10);
    const progressTarget = Math.max(classSize * xpTargetPerStudent, 100);

    const weekTag = weekStart.toISOString().slice(0, 10).replace(/-/g, '');

    return {
      id              : `team-${primaryOffering.id}-w${weekTag}`,
      title           : 'Class Weekly Sprint',
      objective       : 'Earn XP together with your classmates this week.',
      classOfferingId : primaryOffering.id,
      classSize,
      progressCurrent,
      progressTarget,
      contributorCount,
      myContributionXp,
      endsAt          : weekEnd.toISOString(),
      isJoined        : true,
      percentComplete : Math.min(100, Math.round((progressCurrent / progressTarget) * 100)),
    };
  }

  private weekStartUtc(): Date {
    const now = new Date();
    const dow = now.getUTCDay(); // 0=Sun … 6=Sat
    const toMonday = dow === 0 ? -6 : 1 - dow;
    const monday = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + toMonday));
    return monday;
  }

  private weekEndUtc(): Date {
    const start = this.weekStartUtc();
    return new Date(start.getTime() + 7 * 24 * 60 * 60 * 1000 - 1);
  }

  private fallbackChallenge() {
    const end = this.weekEndUtc();
    return {
      id              : 'team-none',
      title           : 'Class Weekly Sprint',
      objective       : 'Enroll in a class to join your team challenge.',
      classOfferingId : null,
      classSize       : 0,
      progressCurrent : 0,
      progressTarget  : 500,
      contributorCount: 0,
      myContributionXp: 0,
      endsAt          : end.toISOString(),
      isJoined        : false,
      percentComplete : 0,
    };
  }
}
