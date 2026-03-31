import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Enrollment } from './entities/enrollment.entity';
import { User } from '../users/entities/user.entity';
import { ClassOffering } from '../class-offerings/entities/class-offering.entity';
import { EnrollmentsService } from './enrollments.service';
import { EnrollmentsController } from './enrollments.controller';

@Module({
  imports: [TypeOrmModule.forFeature([Enrollment, User, ClassOffering])],
  controllers: [EnrollmentsController],
  providers: [EnrollmentsService],
  exports: [EnrollmentsService],
})
export class EnrollmentsModule {}
