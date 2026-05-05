import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AcademicYear } from './entities/academic-year.entity';
import { Term } from './entities/term.entity';
import { ClassOffering } from '../class-offerings/entities/class-offering.entity';
import { AcademicYearsService } from './academic-years.service';
import { AcademicYearsController } from './academic-years.controller';
import { TermDateValidator } from './validation/term-date-validator';

@Module({
  imports: [TypeOrmModule.forFeature([AcademicYear, Term, ClassOffering])],
  controllers: [AcademicYearsController],
  providers: [AcademicYearsService, TermDateValidator],
  exports: [AcademicYearsService],
})
export class AcademicYearsModule {}
