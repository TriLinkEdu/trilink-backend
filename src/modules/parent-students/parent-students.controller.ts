import { Body, Controller, Delete, Get, Param, ParseUUIDPipe, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiParam, ApiResponse, ApiTags } from '@nestjs/swagger';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsOptional, IsString, IsUUID, MinLength } from 'class-validator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { User, UserRole } from '../users/entities/user.entity';
import { ParentStudentsService } from './parent-students.service';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

class LinkDto {
  @ApiProperty() @IsUUID() parentId: string;
  @ApiProperty() @IsUUID() studentId: string;
  @ApiProperty({ example: 'Father' }) @IsString() @MinLength(1) relationship: string;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() isPrimary?: boolean;
}

@ApiTags('Parents')
@Controller('parent-students')
@UseGuards(JwtAuthGuard, RolesGuard)

@ApiBearerAuth('JWT')
export class ParentStudentsController {
  constructor(private readonly svc: ParentStudentsService) {}

  @Get()
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'List parent-student links' })
  list(@Query('parentId') parentId?: string, @Query('studentId') studentId?: string) {
    return this.svc.list({ parentId, studentId });
  }

  @Post()
  @Roles(UserRole.ADMIN)
  create(@Body() dto: LinkDto) {
    return this.svc.create(dto);
  }

  @Get('/mychildren')
  @Roles(UserRole.PARENT)
  @ApiOperation({ summary: 'List my children' })
  myChildren(@CurrentUser() user: User) {
    const parentId = user.id;
    return this.svc.myChildren(parentId);
  }

  @Get('children/:studentId/upcoming')
  @Roles(UserRole.PARENT)
  @ApiOperation({
    summary: "Parent: upcoming exams and assignments for a linked child",
    description:
      'Returns all published exams and assignments for the child\'s enrolled classes, ' +
      'each with a status: upcoming | available | submitted | graded | missed (exams) ' +
      'or pending | submitted | graded | overdue (assignments). ' +
      'Also includes a summary object with counts.',
  })
  @ApiParam({ name: 'studentId', description: 'Student UUID' })
  @ApiResponse({
    status: 200,
    schema: {
      example: {
        student: { id: 'uuid', firstName: 'Ali', lastName: 'Hassan', email: 'ali@school.edu' },
        summary: { examsTotal: 3, examsUpcoming: 1, examsMissed: 0, assignmentsTotal: 4, assignmentsPending: 2, assignmentsOverdue: 0 },
        exams: [{ id: 'uuid', title: 'Biology Midterm', status: 'upcoming', opensAt: '2026-05-10T09:00:00Z', maxPoints: 100, score: null, subjectName: 'Biology', gradeName: 'Grade 9', sectionName: 'A' }],
        assignments: [{ id: 'uuid', title: 'Chapter 3 Worksheet', status: 'pending', deadline: '2026-05-15T23:59:00Z', maxScore: 100, score: null, subjectName: 'Biology' }],
      },
    },
  })
  @ApiResponse({ status: 403, description: 'Not linked to this student' })
  upcomingForChild(
    @Param('studentId', ParseUUIDPipe) studentId: string,
    @CurrentUser() user: User,
  ) {
    return this.svc.upcomingForChild(user.id, studentId);
  }

  @Delete(':id')
  @Roles(UserRole.ADMIN)
  async del(@Param('id', ParseUUIDPipe) id: string) {
    await this.svc.remove(id);
    return { ok: true };
  }
}
