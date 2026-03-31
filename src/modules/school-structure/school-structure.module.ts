import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Grade } from './entities/grade.entity';
import { Section } from './entities/section.entity';
import { Subject } from './entities/subject.entity';
import { SchoolStructureService } from './school-structure.service';
import { SchoolStructureController } from './school-structure.controller';

@Module({
  imports: [TypeOrmModule.forFeature([Grade, Section, Subject])],
  controllers: [SchoolStructureController],
  providers: [SchoolStructureService],
  exports: [SchoolStructureService],
})
export class SchoolStructureModule {}
