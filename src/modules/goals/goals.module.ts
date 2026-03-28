import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { StudentGoal } from './entities/student-goal.entity';
import { User } from '../users/entities/user.entity';
import { ParentStudent } from '../parent-students/entities/parent-student.entity';
import { GoalsService } from './goals.service';
import { GoalsController } from './goals.controller';

@Module({
  imports: [TypeOrmModule.forFeature([StudentGoal, User, ParentStudent])],
  controllers: [GoalsController],
  providers: [GoalsService],
})
export class GoalsModule {}
