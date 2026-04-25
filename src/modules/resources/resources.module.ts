import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ResourcesController } from './resources.controller';
import { TextbooksModule } from '../textbooks/textbooks.module';
import { Subject } from '../school-structure/entities/subject.entity';

@Module({
  imports: [
    TextbooksModule,
    TypeOrmModule.forFeature([Subject])
  ],
  controllers: [ResourcesController],
})
export class ResourcesModule {}
