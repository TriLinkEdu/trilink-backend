import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Badge } from './entities/badge.entity';
import { UserBadge } from './entities/user-badge.entity';
import { LoginStreak } from './entities/login-streak.entity';
import { ExamAttempt } from '../exams/entities/exam-attempt.entity';
import { User } from '../users/entities/user.entity';
import { ParentStudent } from '../parent-students/entities/parent-student.entity';
import { AttendanceSession } from '../attendance/entities/attendance-session.entity';
import { AttendanceMark } from '../attendance/entities/attendance-mark.entity';
import { NotificationsModule } from '../notifications/notifications.module';
import { GamificationService } from './gamification.service';
import { GamificationController } from './gamification.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Badge,
      UserBadge,
      ExamAttempt,
      User,
      ParentStudent,
      AttendanceSession,
      AttendanceMark,
      LoginStreak,
    ]),
    NotificationsModule,
  ],
  controllers: [GamificationController],
  providers: [GamificationService],
  exports: [GamificationService],
})
export class GamificationModule {}
