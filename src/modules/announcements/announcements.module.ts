import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Announcement } from './entities/announcement.entity';
import { Enrollment } from '../enrollments/entities/enrollment.entity';
import { AnnouncementsService } from './announcements.service';
import { AnnouncementsController } from './announcements.controller';

@Module({
  imports: [TypeOrmModule.forFeature([Announcement, Enrollment])],
  controllers: [AnnouncementsController],
  providers: [AnnouncementsService],
  exports: [AnnouncementsService],
})
export class AnnouncementsModule {}
