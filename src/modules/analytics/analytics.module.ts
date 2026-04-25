import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Feedback } from '../feedback/entities/feedback.entity';
import { Exam } from '../exams/entities/exam.entity';
import { ExamAttempt } from '../exams/entities/exam-attempt.entity';
import { AttendanceMark } from '../attendance/entities/attendance-mark.entity';
import { Announcement } from '../announcements/entities/announcement.entity';
import { User } from '../users/entities/user.entity';
import { Enrollment } from '../enrollments/entities/enrollment.entity';
import { ClassOffering } from '../class-offerings/entities/class-offering.entity';
import { AttendanceSession } from '../attendance/entities/attendance-session.entity';
import { StudentGoal } from '../goals/entities/student-goal.entity';
import { AnalyticsService } from './analytics.service';
import { AnalyticsController } from './analytics.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Feedback,
      Exam,
      ExamAttempt,
      AttendanceMark,
      AttendanceSession,
      Announcement,
      User,
      Enrollment,
      ClassOffering,
      StudentGoal,
    ]),
  ],
  controllers: [AnalyticsController],
  providers: [AnalyticsService],
})
export class AnalyticsModule {}
