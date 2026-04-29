import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ParentStudent } from './entities/parent-student.entity';
import { User } from '../users/entities/user.entity';
import { Enrollment } from '../enrollments/entities/enrollment.entity';
import { Exam } from '../exams/entities/exam.entity';
import { ExamAttempt } from '../exams/entities/exam-attempt.entity';
import { Assignment } from '../assignments/entities/assignment.entity';
import { AssignmentSubmission } from '../assignments/entities/assignment-submission.entity';
import { ClassOffering } from '../class-offerings/entities/class-offering.entity';
import { Subject } from '../school-structure/entities/subject.entity';
import { Grade } from '../school-structure/entities/grade.entity';
import { Section } from '../school-structure/entities/section.entity';
import { ParentStudentsService } from './parent-students.service';
import { ParentStudentsController } from './parent-students.controller';

@Module({
  imports: [TypeOrmModule.forFeature([
    ParentStudent, User, Enrollment,
    Exam, ExamAttempt, Assignment, AssignmentSubmission,
    ClassOffering, Subject, Grade, Section,
  ])],
  controllers: [ParentStudentsController],
  providers: [ParentStudentsService],
  exports: [ParentStudentsService],
})
export class ParentStudentsModule {}
