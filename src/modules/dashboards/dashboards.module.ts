import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from '../users/entities/user.entity';
import { ClassOffering } from '../class-offerings/entities/class-offering.entity';
import { Enrollment } from '../enrollments/entities/enrollment.entity';
import { Notification } from '../notifications/entities/notification.entity';
import { ExamAttempt } from '../exams/entities/exam-attempt.entity';
import { Exam } from '../exams/entities/exam.entity';
import { AttendanceSession } from '../attendance/entities/attendance-session.entity';
import { AttendanceMark } from '../attendance/entities/attendance-mark.entity';
import { Announcement } from '../announcements/entities/announcement.entity';
import { ParentStudent } from '../parent-students/entities/parent-student.entity';
import { Feedback } from '../feedback/entities/feedback.entity';
import { DashboardsService } from './dashboards.service';
import { DashboardsController } from './dashboards.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      User,
      ClassOffering,
      Enrollment,
      Notification,
      ExamAttempt,
      Exam,
      AttendanceSession,
      AttendanceMark,
      Announcement,
      ParentStudent,
      Feedback,
    ]),
  ],
  controllers: [DashboardsController],
  providers: [DashboardsService],
})
export class DashboardsModule {}
