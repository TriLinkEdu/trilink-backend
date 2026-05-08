import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { EventEmitterModule } from '@nestjs/event-emitter';

// Entities
import { Badge } from './entities/badge.entity';
import { UserBadge } from './entities/user-badge.entity';
import { LoginStreak } from './entities/login-streak.entity';
import { Achievement } from './entities/achievement.entity';
import { UserAchievement } from './entities/user-achievement.entity';
import { GamificationProfile } from './entities/gamification-profile.entity';

// Cross-module entities
import { ExamAttempt } from '../exams/entities/exam-attempt.entity';
import { User } from '../users/entities/user.entity';
import { ParentStudent } from '../parent-students/entities/parent-student.entity';
import { AttendanceSession } from '../attendance/entities/attendance-session.entity';
import { AttendanceMark } from '../attendance/entities/attendance-mark.entity';
import { Enrollment } from '../enrollments/entities/enrollment.entity';
import { Subject } from '../school-structure/entities/subject.entity';
import { Question } from '../exams/entities/question.entity';
import { ClassOffering } from '../class-offerings/entities/class-offering.entity';
import { Topic } from '../topics/entities/topic.entity';

// Modules
import { NotificationsModule } from '../notifications/notifications.module';

// Services
import { GamificationService } from './gamification.service';
import { XpService } from './services/xp.service';
import { AchievementEngine } from './services/achievement-engine.service';
import { TeamChallengeService } from './services/team-challenge.service';
import { GamificationHubService } from './services/gamification-hub.service';

// Controllers
import { GamificationController } from './gamification.controller';

// Providers
import { RedisClientProvider } from './providers/redis-client.provider';

@Module({
  imports: [
    // EventEmitter enables the decoupled domain-event architecture.
    // wildcard: true allows pattern-based listeners in future.
    EventEmitterModule.forRoot({ wildcard: true }),

    TypeOrmModule.forFeature([
      // Gamification-owned entities
      Badge,
      UserBadge,
      Achievement,
      UserAchievement,
      GamificationProfile,  // NEW: materialized XP/level profile
      LoginStreak,

      // Cross-module entities (read-only access)
      ExamAttempt,
      User,
      ParentStudent,
      AttendanceSession,
      AttendanceMark,
      Enrollment,
      Subject,
      Question,
      ClassOffering,
      Topic,
    ]),

    NotificationsModule,
  ],
  controllers: [GamificationController],
  providers: [
    // Raw Redis client (sorted sets for leaderboards)
    RedisClientProvider,

    // Core services
    GamificationService,

    // Focused domain services
    XpService,            // Phase 2 & 3: materialized XP + Redis leaderboards
    AchievementEngine,    // Phase 4: async achievement checks via events
    TeamChallengeService, // Phase 5: real class-scoped team challenges
    GamificationHubService, // Phase 1: BFF aggregator (10 requests → 1)
  ],
  exports: [
    GamificationService,
    XpService,
    AchievementEngine,
    TeamChallengeService,
  ],
})
export class GamificationModule {}
