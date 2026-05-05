import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule } from '@nestjs/config';
import { ParentStudentsModule } from '../parent-students/parent-students.module';
import { EmailModule } from '../email/email.module';
import { User } from './entities/user.entity';
import { ParentStudent } from '../parent-students/entities/parent-student.entity';
import { UsersService } from './users.service';
import { UserFilterService } from './services/user-filter.service';
import { UsersController } from './users.controller';

@Module({
  imports: [TypeOrmModule.forFeature([User, ParentStudent]), ParentStudentsModule, EmailModule, ConfigModule],
  controllers: [UsersController],
  providers: [UsersService, UserFilterService],
  exports: [UsersService, UserFilterService],
})
export class UsersModule {}
