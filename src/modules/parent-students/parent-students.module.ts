import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ParentStudent } from './entities/parent-student.entity';
import { User } from '../users/entities/user.entity';
import { ParentStudentsService } from './parent-students.service';
import { ParentStudentsController } from './parent-students.controller';

@Module({
  imports: [TypeOrmModule.forFeature([ParentStudent, User])],
  controllers: [ParentStudentsController],
  providers: [ParentStudentsService],
  exports: [ParentStudentsService],
})
export class ParentStudentsModule {}
