import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ReportCardRemark } from './entities/report-card-remark.entity';
import { Term } from '../academic-years/entities/term.entity';
import { AcademicYear } from '../academic-years/entities/academic-year.entity';
import { Enrollment } from '../enrollments/entities/enrollment.entity';
import { ClassOffering } from '../class-offerings/entities/class-offering.entity';
import { GradeEntry } from '../grades/entities/grade-entry.entity';
import { AttendanceSession } from '../attendance/entities/attendance-session.entity';
import { AttendanceMark } from '../attendance/entities/attendance-mark.entity';
import { User } from '../users/entities/user.entity';
import { Subject } from '../school-structure/entities/subject.entity';
import { ParentStudent } from '../parent-students/entities/parent-student.entity';
import { HomeroomAssignment } from '../homeroom/entities/homeroom-assignment.entity';
import { ReportCardsService } from './report-cards.service';
import { ReportCardsController } from './report-cards.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      ReportCardRemark,
      Term,
      AcademicYear,
      Enrollment,
      ClassOffering,
      GradeEntry,
      AttendanceSession,
      AttendanceMark,
      User,
      Subject,
      ParentStudent,
      HomeroomAssignment,
    ]),
  ],
  controllers: [ReportCardsController],
  providers: [ReportCardsService],
  exports: [ReportCardsService],
})
export class ReportCardsModule {}
