import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ParentStudent } from '../parent-students/entities/parent-student.entity';
import { User } from '../users/entities/user.entity';
import { AiService } from './ai.service';
import { AiController } from './ai.controller';

@Module({
  imports: [TypeOrmModule.forFeature([ParentStudent, User])],
  controllers: [AiController],
  providers: [AiService],
})
export class AiModule {}
