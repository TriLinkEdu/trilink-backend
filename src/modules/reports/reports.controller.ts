import { BadRequestException, Controller, Get, Param, ParseUUIDPipe, Query, UseGuards, UseInterceptors } from '@nestjs/common';
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

  @Get('students/:studentId/report')
  @Roles(UserRole.ADMIN, UserRole.TEACHER, UserRole.STUDENT, UserRole.PARENT)
  @ApiOperation({
    summary: 'Comprehensive student report (weekly, monthly, or custom date range)',
    description:
      'Access rules: student self, linked parent, teacher of student\'s enrolled classes, or admin. Includes populated class/subject/teacher details, attendance detail, and assessment aggregates.',
  })
  @ApiQuery({
    name: 'periodType',
    required: false,
    example: 'weekly',
    description: 'weekly | monthly | custom (default: custom)',
  })
  @ApiQuery({
    name: 'startDate',
    required: false,
    example: '2026-01-01',
    description: 'Required when periodType=custom (YYYY-MM-DD)',
  })
  @ApiQuery({
    name: 'endDate',
    required: false,
    example: '2026-01-31',
    description: 'Required when periodType=custom (YYYY-MM-DD)',
  })
  studentReport(
    @Param('studentId', ParseUUIDPipe) studentId: string,
    @CurrentUser() user: User,
    @Query('periodType') periodType?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    const normalizedType = (periodType ?? 'custom').toLowerCase();
    if (normalizedType === 'custom' && (!startDate || !endDate)) {
      throw new BadRequestException('startDate and endDate query parameters are required for custom period');
    }
    if (!['weekly', 'monthly', 'custom'].includes(normalizedType)) {
      throw new BadRequestException('periodType must be one of: weekly, monthly, custom');
    }
    return this.reports.studentReport(studentId, user, normalizedType as 'weekly' | 'monthly' | 'custom', startDate, endDate);
  }

  @Get('students/:studentId/teachers')
  @Roles(UserRole.ADMIN, UserRole.TEACHER, UserRole.STUDENT, UserRole.PARENT)
  @ApiOperation({
    summary: 'Get list of teachers for a student',
    description: 'Returns teachers based on student enrollments. Useful for parent-teacher communication.',
  })
  getTeachers(@Param('studentId', ParseUUIDPipe) studentId: string, @CurrentUser() user: User) {
    return this.reports.getStudentTeachers(studentId, user);
  }
}
