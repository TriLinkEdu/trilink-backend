import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { HttpModule } from '@nestjs/axios';
import { Question } from './entities/question.entity';
import { Exam } from './entities/exam.entity';
import { ExamQuestion } from './entities/exam-question.entity';
import { ExamAttempt } from './entities/exam-attempt.entity';
import { User } from '../users/entities/user.entity';
import { Enrollment } from '../enrollments/entities/enrollment.entity';
import { ParentStudent } from '../parent-students/entities/parent-student.entity';
import { ClassOffering } from '../class-offerings/entities/class-offering.entity';
import { Grade } from '../school-structure/entities/grade.entity';
import { Section } from '../school-structure/entities/section.entity';
import { Subject } from '../school-structure/entities/subject.entity';
import { ClassOfferingsModule } from '../class-offerings/class-offerings.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { GamificationModule } from '../gamification/gamification.module';
import { GradesModule } from '../grades/grades.module';
import { ExamsService } from './exams.service';import { QuestionsController } from './questions.controller';
import { ExamsController } from './exams.controller';
import { ExamAttemptsController } from './exam-attempts.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Question,
      Exam,
      ExamQuestion,
      ExamAttempt,
      Enrollment,
      User,
      ParentStudent,
      ClassOffering,
      Grade,
      Section,
      Subject,
    ]),
    ClassOfferingsModule,
    NotificationsModule,
    GamificationModule,
    GradesModule,
    HttpModule,
  ],
  controllers: [QuestionsController, ExamsController, ExamAttemptsController],
  providers: [ExamsService],
  exports: [ExamsService],
})
export class ExamsModule {}
