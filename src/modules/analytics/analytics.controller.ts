import { Controller, Get, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { User, UserRole } from '../users/entities/user.entity';
import { AnalyticsService } from './analytics.service';

@ApiTags('Analytics')
@Controller('analytics')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN)
@ApiBearerAuth('JWT')
export class AnalyticsController {
  constructor(private readonly analytics: AnalyticsService) {}

  @Get('admin/summary')
  @ApiOperation({
    summary: 'School-wide analytics snapshot',
    description: 'Aggregates feedback, exams, attempts, attendance marks (last 30 days), users.',
  })
  summary() {
    return this.analytics.adminSummary();
  }

  @Get('student/weekly-snapshot')
  @Roles(UserRole.STUDENT)
  @ApiOperation({ summary: 'Student weekly snapshot' })
  studentWeeklySnapshot(@CurrentUser() user: User) {
    return this.analytics.studentWeeklySnapshot(user.id);
  }

  @Get('student/performance-trends')
  @Roles(UserRole.STUDENT)
  @ApiOperation({ summary: 'Student performance trends' })
  studentPerformanceTrends(@CurrentUser() user: User) {
    return this.analytics.studentPerformanceTrends(user.id);
  }

  @Get('student/attendance-insights')
  @Roles(UserRole.STUDENT)
  @ApiOperation({ summary: 'Student attendance insights' })
  studentAttendanceInsights(@CurrentUser() user: User) {
    return this.analytics.studentAttendanceInsights(user.id);
  }

  @Get('student/action-plan')
  @Roles(UserRole.STUDENT)
  @ApiOperation({ summary: 'Student action plan' })
  studentActionPlan(@CurrentUser() user: User) {
    return this.analytics.studentActionPlan(user.id);
  }
}
