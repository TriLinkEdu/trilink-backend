import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ParentStudent } from '../parent-students/entities/parent-student.entity';
import { ReportsModule } from '../reports/reports.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { WeeklyDigestService } from './weekly-digest.service';

@Module({
  imports: [TypeOrmModule.forFeature([ParentStudent]), ReportsModule, NotificationsModule],
  providers: [WeeklyDigestService],
})
export class DigestModule {}
