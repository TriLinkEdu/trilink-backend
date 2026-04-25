import { Module } from '@nestjs/common';
import { CurriculumController } from './curriculum.controller';
import { EnrollmentsModule } from '../enrollments/enrollments.module';
import { TopicsModule } from '../topics/topics.module';

@Module({
  imports: [EnrollmentsModule, TopicsModule],
  controllers: [CurriculumController],
})
export class CurriculumModule {}
