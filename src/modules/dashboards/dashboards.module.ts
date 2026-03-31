import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from '../users/entities/user.entity';
import { ClassOffering } from '../class-offerings/entities/class-offering.entity';
import { Enrollment } from '../enrollments/entities/enrollment.entity';
import { Notification } from '../notifications/entities/notification.entity';
import { ExamAttempt } from '../exams/entities/exam-attempt.entity';
import { ParentStudent } from '../parent-students/entities/parent-student.entity';
import { DashboardsService } from './dashboards.service';
import { DashboardsController } from './dashboards.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([User, ClassOffering, Enrollment, Notification, ExamAttempt, ParentStudent]),
  ],
  controllers: [DashboardsController],
  providers: [DashboardsService],
})
export class DashboardsModule {}
