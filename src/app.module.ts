import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import appConfig from './config/app.config';
import { DatabaseModule } from './database/database.module';
import { AuthModule } from './modules/auth/auth.module';
import { UsersModule } from './modules/users/users.module';
import { AcademicYearsModule } from './modules/academic-years/academic-years.module';
import { SchoolStructureModule } from './modules/school-structure/school-structure.module';
import { ClassOfferingsModule } from './modules/class-offerings/class-offerings.module';
import { EnrollmentsModule } from './modules/enrollments/enrollments.module';
import { ParentStudentsModule } from './modules/parent-students/parent-students.module';
import { CalendarModule } from './modules/calendar/calendar.module';
import { AttendanceModule } from './modules/attendance/attendance.module';
import { ExamsModule } from './modules/exams/exams.module';
import { AnnouncementsModule } from './modules/announcements/announcements.module';
import { FeedbackModule } from './modules/feedback/feedback.module';
import { NotificationsModule } from './modules/notifications/notifications.module';
import { ChatModule } from './modules/chat/chat.module';
import { DashboardsModule } from './modules/dashboards/dashboards.module';
import { SettingsModule } from './modules/settings/settings.module';
import { FilesModule } from './modules/files/files.module';
import { AuditModule } from './modules/audit/audit.module';
import { AiModule } from './modules/ai/ai.module';
import { GamificationModule } from './modules/gamification/gamification.module';
import { GoalsModule } from './modules/goals/goals.module';
import { StudentProfilesModule } from './modules/student-profiles/student-profiles.module';
import { ReportsModule } from './modules/reports/reports.module';
import { AnalyticsModule } from './modules/analytics/analytics.module';
import { IntegrationsModule } from './modules/integrations/integrations.module';
import { DigestModule } from './modules/digest/digest.module';
import { HealthModule } from './modules/health/health.module';
import { GradesModule } from './modules/grades/grades.module';
import { AssignmentsModule } from './modules/assignments/assignments.module';
import { RealtimeModule } from './modules/realtime/realtime.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, load: [appConfig] }),
    HealthModule,
    ScheduleModule.forRoot(),
    ThrottlerModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        throttlers: [
          {
            ttl: config.get<number>('throttle.ttl') ?? 60000,
            limit: config.get<number>('throttle.limit') ?? 150,
          },
        ],
      }),
    }),
    DatabaseModule,
    AuditModule,
    AuthModule,
    UsersModule,
    AcademicYearsModule,
    SchoolStructureModule,
    ClassOfferingsModule,
    EnrollmentsModule,
    ParentStudentsModule,
    CalendarModule,
    AttendanceModule,
    ExamsModule,
    AnnouncementsModule,
    FeedbackModule,
    NotificationsModule,
    ChatModule,
    DashboardsModule,
    SettingsModule,
    FilesModule,
    AiModule,
    GamificationModule,
    GoalsModule,
    StudentProfilesModule,
    ReportsModule,
    AnalyticsModule,
    IntegrationsModule,
    DigestModule,
    RealtimeModule,
    GradesModule,
    AssignmentsModule,
  ],
  providers: [{ provide: APP_GUARD, useClass: ThrottlerGuard }],
})
export class AppModule {}
