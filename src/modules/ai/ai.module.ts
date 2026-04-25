import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ParentStudent } from '../parent-students/entities/parent-student.entity';
import { User } from '../users/entities/user.entity';
import { AttendanceMark } from '../attendance/entities/attendance-mark.entity';
import { ExamAttempt } from '../exams/entities/exam-attempt.entity';
import { Exam } from '../exams/entities/exam.entity';
import { LoginStreak } from '../gamification/entities/login-streak.entity';
import { Enrollment } from '../enrollments/entities/enrollment.entity';
import { ClassOffering } from '../class-offerings/entities/class-offering.entity';
import { AiService } from './ai.service';
import { AiController } from './ai.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      ParentStudent,
      User,
      AttendanceMark,
      ExamAttempt,
      Exam,
      LoginStreak,
      Enrollment,
      ClassOffering,
    ]),
  ],
  controllers: [AiController],
  providers: [AiService],
})
export class AiModule {}
