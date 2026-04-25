import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { GradeEntry } from './entities/grade-entry.entity';
import { User } from '../users/entities/user.entity';
import { ClassOffering } from '../class-offerings/entities/class-offering.entity';
import { Enrollment } from '../enrollments/entities/enrollment.entity';
import { ParentStudent } from '../parent-students/entities/parent-student.entity';
import { Grade } from '../school-structure/entities/grade.entity';
import { Section } from '../school-structure/entities/section.entity';
import { Subject } from '../school-structure/entities/subject.entity';
import { NotificationsModule } from '../notifications/notifications.module';
import { GradesService } from './grades.service';
import { GradesController } from './grades.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([GradeEntry, User, ClassOffering, Enrollment, ParentStudent, Grade, Section, Subject]),
    NotificationsModule,
  ],
  controllers: [GradesController],
  providers: [GradesService],
  exports: [GradesService],
})
export class GradesModule {}
