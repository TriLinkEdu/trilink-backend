import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { HomeroomAssignment } from './entities/homeroom-assignment.entity';
import { AcademicYear } from '../academic-years/entities/academic-year.entity';
import { ClassOffering } from '../class-offerings/entities/class-offering.entity';
import { Enrollment } from '../enrollments/entities/enrollment.entity';
import { User } from '../users/entities/user.entity';
import { Grade } from '../school-structure/entities/grade.entity';
import { Section } from '../school-structure/entities/section.entity';
import { HomeroomService } from './homeroom.service';
import { HomeroomController } from './homeroom.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      HomeroomAssignment,
      AcademicYear,
      ClassOffering,
      Enrollment,
      User,
      Grade,
      Section,
    ]),
  ],
  controllers: [HomeroomController],
  providers: [HomeroomService],
  exports: [HomeroomService],
})
export class HomeroomModule {}
