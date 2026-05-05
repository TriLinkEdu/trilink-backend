import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Grade } from './entities/grade.entity';
import { Section } from './entities/section.entity';
import { Subject } from './entities/subject.entity';
import { GradeSectionAssignment } from './entities/grade-section-assignment.entity';
import { ClassOffering } from '../class-offerings/entities/class-offering.entity';
import { SchoolStructureService } from './school-structure.service';
import { GradeSectionService } from './services/grade-section.service';
import { GradeSubjectService } from './services/grade-subject.service';
import { GradeSubjectAssignment } from './entities/grade-subject-assignment.entity';
import { SchoolStructureController, GradeSectionController } from './school-structure.controller';

@Module({
  imports: [TypeOrmModule.forFeature([Grade, Section, Subject, GradeSectionAssignment, GradeSubjectAssignment, ClassOffering])],
  controllers: [SchoolStructureController, GradeSectionController],
  providers: [SchoolStructureService, GradeSectionService, GradeSubjectService],
  exports: [SchoolStructureService, GradeSectionService, GradeSubjectService],
})
export class SchoolStructureModule {}
