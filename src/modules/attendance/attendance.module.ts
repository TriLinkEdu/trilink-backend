import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AttendanceSession } from './entities/attendance-session.entity';
import { AttendanceMark } from './entities/attendance-mark.entity';
import { Enrollment } from '../enrollments/entities/enrollment.entity';
import { ParentStudent } from '../parent-students/entities/parent-student.entity';
import { ClassOffering } from '../class-offerings/entities/class-offering.entity';
import { Subject } from '../school-structure/entities/subject.entity';
import { Grade } from '../school-structure/entities/grade.entity';
import { Section } from '../school-structure/entities/section.entity';
import { User } from '../users/entities/user.entity';
import { NotificationsModule } from '../notifications/notifications.module';
import { GamificationModule } from '../gamification/gamification.module';
import { AuditModule } from '../audit/audit.module';
import { AttendanceService } from './attendance.service';
import { AttendanceController } from './attendance.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      AttendanceSession,
      AttendanceMark,
      Enrollment,
      ParentStudent,
      ClassOffering,
      Subject,
      Grade,
      Section,
      User,
    ]),
    NotificationsModule,
    GamificationModule,
    AuditModule,
  ],
  controllers: [AttendanceController],
  providers: [AttendanceService],
  exports: [AttendanceService],
})
export class AttendanceModule {}
