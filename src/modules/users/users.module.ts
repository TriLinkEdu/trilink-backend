import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule } from '@nestjs/config';
import { ParentStudentsModule } from '../parent-students/parent-students.module';
import { EmailModule } from '../email/email.module';
import { User } from './entities/user.entity';
import { FileRecord } from '../files/entities/file-record.entity';
import { ParentStudent } from '../parent-students/entities/parent-student.entity';
import { Enrollment } from '../enrollments/entities/enrollment.entity';
import { ClassOffering } from '../class-offerings/entities/class-offering.entity';
import { AcademicYear } from '../academic-years/entities/academic-year.entity';
import { UsersService } from './users.service';
import { UserFilterService } from './services/user-filter.service';
import { UsersController } from './users.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([User, FileRecord, ParentStudent, Enrollment, ClassOffering, AcademicYear]),
    ParentStudentsModule,
    EmailModule,
    ConfigModule,
  ],
  controllers: [UsersController],
  providers: [UsersService, UserFilterService],
  exports: [UsersService, UserFilterService],
})
export class UsersModule {}
