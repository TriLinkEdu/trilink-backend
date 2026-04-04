import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ClassOffering } from './entities/class-offering.entity';
import { User } from '../users/entities/user.entity';
import { Grade } from '../school-structure/entities/grade.entity';
import { Section } from '../school-structure/entities/section.entity';
import { Subject } from '../school-structure/entities/subject.entity';
import { ClassOfferingsService } from './class-offerings.service';
import { ClassOfferingsController } from './class-offerings.controller';

@Module({
  imports: [TypeOrmModule.forFeature([ClassOffering, User, Grade, Section, Subject])],
  controllers: [ClassOfferingsController],
  providers: [ClassOfferingsService],
  exports: [ClassOfferingsService],
})
export class ClassOfferingsModule {}
