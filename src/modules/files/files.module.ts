import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { FileRecord } from './entities/file-record.entity';
import { FilesService } from './files.service';
import { FilesController } from './files.controller';

@Module({
  imports: [TypeOrmModule.forFeature([FileRecord])],
  controllers: [FilesController],
  providers: [FilesService],
})
export class FilesModule {}
