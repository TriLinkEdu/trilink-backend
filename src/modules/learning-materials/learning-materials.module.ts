import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { LearningMaterial } from './entities/learning-material.entity';
import { Enrollment } from '../enrollments/entities/enrollment.entity';
import { LearningMaterialsService } from './learning-materials.service';
import { LearningMaterialsController } from './learning-materials.controller';
import { FilesModule } from '../files/files.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([LearningMaterial, Enrollment]),
    FilesModule,
  ],
  controllers: [LearningMaterialsController],
  providers: [LearningMaterialsService],
  exports: [LearningMaterialsService],
})
export class LearningMaterialsModule {}
