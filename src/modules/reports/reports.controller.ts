import { Controller, Get, Param, ParseUUIDPipe, Query, UseGuards, UseInterceptors } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole } from '../users/entities/user.entity';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { User } from '../users/entities/user.entity';
import { ReportsService } from './reports.service';
import { EtagInterceptor } from '../../common/interceptors/etag.interceptor';

@ApiTags('Reports')
@Controller('reports')
@UseGuards(JwtAuthGuard, RolesGuard)
@UseInterceptors(EtagInterceptor)
@ApiBearerAuth('JWT')
export class ReportsController {
  constructor(private readonly reports: ReportsService) {}

  @Get('students/:studentId/performance')
  @Roles(UserRole.ADMIN, UserRole.TEACHER, UserRole.STUDENT, UserRole.PARENT)
  @ApiOperation({
    summary: 'Overall performance (attendance + released exams)',
    description: 'Student self, linked parent, or staff.',
  })
  performance(@Param('studentId', ParseUUIDPipe) studentId: string, @CurrentUser() user: User) {
    return this.reports.performanceReport(studentId, user);
  }

  @Get('students/:studentId/compare')
  @Roles(UserRole.ADMIN, UserRole.TEACHER, UserRole.STUDENT, UserRole.PARENT)
  @ApiOperation({ summary: 'Compare two date ranges (attendance + exam averages)' })
  @ApiQuery({ name: 'period1Start', example: '2026-01-01' })
  @ApiQuery({ name: 'period1End', example: '2026-03-01' })
  @ApiQuery({ name: 'period2Start', example: '2026-03-02' })
  @ApiQuery({ name: 'period2End', example: '2026-06-01' })
  compare(
    @Param('studentId', ParseUUIDPipe) studentId: string,
    @CurrentUser() user: User,
    @Query('period1Start') p1s: string,
    @Query('period1End') p1e: string,
    @Query('period2Start') p2s: string,
    @Query('period2End') p2e: string,
  ) {
    return this.reports.comparePeriods(studentId, user, p1s, p1e, p2s, p2e);
  }

  @Get('parent/weekly-summary')
  @Roles(UserRole.PARENT, UserRole.ADMIN)
  @ApiOperation({
    summary: 'Weekly summary for linked children',
    description: 'Parent: all linked children, or pass childStudentId for one. Admin: childStudentId required.',
  })
  @ApiQuery({ name: 'childStudentId', required: false })
  weekly(@CurrentUser() user: User, @Query('childStudentId') childId?: string) {
    return this.reports.weeklyParentSummary(user, childId);
  }

  @Get('my-grades')
  @Roles(UserRole.STUDENT)
  @ApiOperation({ summary: 'Grades by subject (released exams in enrolled classes)' })
  myGrades(@CurrentUser() user: User) {
    return this.reports.myGradesBySubject(user);
  }
}
