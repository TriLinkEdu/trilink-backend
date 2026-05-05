import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from '../users/entities/user.entity';
import { Subject } from '../school-structure/entities/subject.entity';
import { ClassOffering } from '../class-offerings/entities/class-offering.entity';
import { Grade } from '../school-structure/entities/grade.entity';
import { Section } from '../school-structure/entities/section.entity';
import { GlobalSearchService } from './search.service';
import { SearchController } from './search.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([User, Subject, ClassOffering, Grade, Section]),
  ],
  controllers: [SearchController],
  providers: [GlobalSearchService],
  exports: [GlobalSearchService],
})
export class SearchModule {}
