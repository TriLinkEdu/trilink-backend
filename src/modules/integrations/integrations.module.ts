import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { IntegrationsController } from './integrations.controller';
import { StudentSyncController } from './student-sync.controller';
import { Notification } from '../notifications/entities/notification.entity';
import { GradeEntry } from '../grades/entities/grade-entry.entity';
import { AttendanceMark } from '../attendance/entities/attendance-mark.entity';
import { ExamAttempt } from '../exams/entities/exam-attempt.entity';
import { ParentStudent } from '../parent-students/entities/parent-student.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Notification, GradeEntry, AttendanceMark, ExamAttempt, ParentStudent])],
  controllers: [IntegrationsController, StudentSyncController],
})
export class IntegrationsModule {}
