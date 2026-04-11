import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Question } from './entities/question.entity';
import { Exam } from './entities/exam.entity';
import { ExamQuestion } from './entities/exam-question.entity';
import { ExamAttempt } from './entities/exam-attempt.entity';
import { User } from '../users/entities/user.entity';
import { Enrollment } from '../enrollments/entities/enrollment.entity';
import { ParentStudent } from '../parent-students/entities/parent-student.entity';
import { NotificationsModule } from '../notifications/notifications.module';
import { GamificationModule } from '../gamification/gamification.module';
import { ExamsService } from './exams.service';
import { QuestionsController } from './questions.controller';
import { ExamsController } from './exams.controller';
import { ExamAttemptsController } from './exam-attempts.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([Question, Exam, ExamQuestion, ExamAttempt, Enrollment, User, ParentStudent]),
    NotificationsModule,
    GamificationModule,
  ],
  controllers: [QuestionsController, ExamsController, ExamAttemptsController],
  providers: [ExamsService],
  exports: [ExamsService],
})
export class ExamsModule {}
