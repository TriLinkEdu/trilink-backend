import { Controller, Get, Param, ParseUUIDPipe, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiParam, ApiResponse, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole } from '../users/entities/user.entity';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { User } from '../users/entities/user.entity';
import { DashboardsService } from './dashboards.service';
import { ParentStudent } from '../parent-students/entities/parent-student.entity';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ForbiddenException } from '@nestjs/common';

@ApiTags('Dashboard')
@Controller('dashboard')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth('JWT')
export class DashboardsController {
  constructor(
    private readonly dash: DashboardsService,
    @InjectRepository(ParentStudent) private readonly psRepo: Repository<ParentStudent>,
  ) {}

  @Get('admin')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Admin summary counts' })
  admin() {
    return this.dash.admin();
  }

  @Get('teacher')
  @Roles(UserRole.TEACHER)
  teacher(@CurrentUser() user: User) {
    return this.dash.teacher(user.id);
  }

  @Get('student')
  @Roles(UserRole.STUDENT)
  student(@CurrentUser() user: User) {
    return this.dash.student(user.id);
  }

  @Get('parent')
  @Roles(UserRole.PARENT)
  parent(@CurrentUser() user: User) {
    return this.dash.parent(user.id);
  }

  @Get('children/:studentId/summary')
  @Roles(UserRole.PARENT, UserRole.ADMIN)
  @ApiOperation({ summary: 'Parent: high-level child summary (link check)' })
  async childSummary(@Param('studentId', ParseUUIDPipe) studentId: string, @CurrentUser() user: User) {
    if (user.role === UserRole.PARENT) {
      const link = await this.psRepo.findOne({ where: { parentId: user.id, studentId } });
      if (!link) throw new ForbiddenException('Not linked to this student');
    }
    return this.dash.student(studentId);
  }

  @Get('children/:studentId')
  @Roles(UserRole.PARENT, UserRole.ADMIN)
  @ApiOperation({
    summary: 'Parent: full child dashboard',
    description:
      'Returns grades average per subject (all released entries), ' +
      'overall attendance % and per-subject breakdown, ' +
      'and upcoming/active exams & assignments for the child. ' +
      'Requires a valid parent-student link.',
  })
  @ApiParam({ name: 'studentId', description: 'Student UUID' })
  @ApiResponse({
    status: 200,
    schema: {
      example: {
        student: { id: 'uuid', firstName: 'Ali', lastName: 'Hassan', email: 'ali@school.edu' },
        grades: {
          overallAveragePercent: 81.4,
          bySubject: [
            { subjectId: 'uuid', subjectName: 'Biology', gradedEntries: 5, averagePercent: 84.2 },
          ],
        },
        attendance: {
          overall: { total: 60, present: 52, absent: 4, excused: 4, attendancePercent: 86.7 },
          bySubject: [
            { subjectId: 'uuid', subjectName: 'Biology', total: 20, present: 18, absent: 1, excused: 1, attendancePercent: 90.0 },
          ],
        },
        upcoming: {
          exams: [{ id: 'uuid', title: 'Biology Midterm', opensAt: '2026-05-10T09:00:00Z', closesAt: '2026-05-10T11:00:00Z', maxPoints: 100, status: 'upcoming', score: null, classOfferingId: 'uuid' }],
          assignments: [{ id: 'uuid', title: 'Chapter 3 Worksheet', deadline: '2026-05-15T23:59:00Z', maxScore: 100, status: 'pending', score: null, classOfferingId: 'uuid' }],
          summary: { examsTotal: 2, examsAvailable: 0, assignmentsTotal: 3, assignmentsPending: 2 },
        },
      },
    },
  })
  @ApiResponse({ status: 403, description: 'Not linked to this student' })
  @ApiResponse({ status: 404, description: 'Student not found' })
  async childDashboard(
    @Param('studentId', ParseUUIDPipe) studentId: string,
    @CurrentUser() user: User,
  ) {
    const parentId = user.role === UserRole.ADMIN ? null : user.id;
    return this.dash.parentChildDashboard(parentId, studentId);
  }
}
