import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { StudentProfile } from './entities/student-profile.entity';
import { User } from '../users/entities/user.entity';
import { ParentStudent } from '../parent-students/entities/parent-student.entity';
import { StudentProfilesService } from './student-profiles.service';
import { StudentProfilesController } from './student-profiles.controller';
import { Enrollment } from '../enrollments/entities/enrollment.entity';
import { ClassOffering } from '../class-offerings/entities/class-offering.entity';
import { Grade } from '../school-structure/entities/grade.entity';
import { Section } from '../school-structure/entities/section.entity';
import { Subject } from '../school-structure/entities/subject.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      StudentProfile,
      User,
      ParentStudent,
      Enrollment,
      ClassOffering,
      Grade,
      Section,
      Subject,
    ]),
  ],
  controllers: [StudentProfilesController],
  providers: [StudentProfilesService],
})
export class StudentProfilesModule {}
