import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { HttpModule } from '@nestjs/axios';
import { Textbook } from './entities/textbook.entity';
import { TextbooksService } from './textbooks.service';
import { TextbooksController } from './textbooks.controller';
import { FilesModule } from '../files/files.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Textbook]),
    FilesModule, // provides FilesService + RESOURCE_STORAGE_PROVIDER
    HttpModule,
  ],
  controllers: [TextbooksController],

  providers: [TextbooksService],
  exports: [TextbooksService],
})
export class TextbooksModule {}
