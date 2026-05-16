import {
  Body, Controller, Delete, Get, Param, ParseUUIDPipe,
  Patch, Post, Query, UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth, ApiBody, ApiOperation, ApiParam,
  ApiQuery, ApiResponse, ApiTags,
} from '@nestjs/swagger';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsDateString, IsEnum, IsNumber, IsOptional,
  IsString, IsUUID, Min, MinLength,
} from 'class-validator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole } from '../users/entities/user.entity';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { User } from '../users/entities/user.entity';
import { AssignmentsService } from './assignments.service';
import { SubmissionType } from './entities/assignment.entity';

// ── DTOs ──────────────────────────────────────────────────────────────────────

class CreateAssignmentDto {
  @ApiProperty() @IsUUID() classOfferingId: string;
  @ApiProperty({ minLength: 1 }) @IsString() @MinLength(1) title: string;
  @ApiPropertyOptional() @IsOptional() @IsString() description?: string;
  @ApiProperty({ enum: SubmissionType, enumName: 'SubmissionType', description: 'file | text | none' })
  @IsEnum(SubmissionType) submissionType: SubmissionType;
  @ApiPropertyOptional({ description: 'UUID of an uploaded file to attach (e.g. worksheet PDF)' })
  @IsOptional() @IsUUID() attachmentFileId?: string;
  @ApiProperty({ example: '2026-05-15T23:59:00.000Z', description: 'ISO deadline' })
  @IsDateString() deadline: string;
  @ApiPropertyOptional({ default: 100 }) @IsOptional() @IsNumber() @Min(1) maxScore?: number;
  @ApiProperty() @IsUUID() termId: string;
}

class UpdateAssignmentDto {
  @ApiPropertyOptional() @IsOptional() @IsString() @MinLength(1) title?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() description?: string;
  @ApiPropertyOptional({ enum: SubmissionType }) @IsOptional() @IsEnum(SubmissionType) submissionType?: SubmissionType;
  @ApiPropertyOptional() @IsOptional() @IsUUID() attachmentFileId?: string;
  @ApiPropertyOptional() @IsOptional() @IsDateString() deadline?: string;
  @ApiPropertyOptional() @IsOptional() @IsNumber() @Min(1) maxScore?: number;
  @ApiPropertyOptional() @IsOptional() @IsUUID() termId?: string;
}

class SubmitAssignmentDto {
  @ApiPropertyOptional({ description: 'File UUID (required when submissionType = file)' })
  @IsOptional() @IsUUID() fileId?: string;
  @ApiPropertyOptional({ description: 'Text response (required when submissionType = text)' })
  @IsOptional() @IsString() textContent?: string;
}

class GradeSubmissionDto {
  @ApiProperty({ description: 'Score (0 to maxScore)' }) @IsNumber() @Min(0) score: number;
  @ApiPropertyOptional({ description: 'Optional feedback for the student' }) @IsOptional() @IsString() feedback?: string;
}

// ── Controller ────────────────────────────────────────────────────────────────

@ApiTags('Assignments')
@Controller('assignments')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth('JWT')
export class AssignmentsController {
  constructor(private readonly svc: AssignmentsService) {}

  // ── Teacher: manage ────────────────────────────────────────────────────────

  @Post()
  @Roles(UserRole.ADMIN, UserRole.TEACHER)
  @ApiOperation({ summary: 'Create an assignment (draft)', description: 'Creates an unpublished assignment. Call POST /assignments/:id/publish to make it visible to students.' })
  @ApiBody({ type: CreateAssignmentDto })
  @ApiResponse({ status: 201, description: 'Assignment created (draft)' })
  create(@Body() dto: CreateAssignmentDto, @CurrentUser() user: User) {
    return this.svc.create(dto, user);
  }

  @Patch(':id')
  @Roles(UserRole.ADMIN, UserRole.TEACHER)
  @ApiOperation({ summary: 'Update assignment (draft only)', description: 'Cannot edit a published assignment. Unpublish first.' })
  @ApiParam({ name: 'id', description: 'Assignment UUID' })
  @ApiBody({ type: UpdateAssignmentDto })
  update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateAssignmentDto, @CurrentUser() user: User) {
    return this.svc.update(id, dto, user);
  }

  @Post(':id/publish')
  @Roles(UserRole.ADMIN, UserRole.TEACHER)
  @ApiOperation({ summary: 'Publish assignment to students', description: 'Makes the assignment visible and sends notifications to all enrolled students.' })
  @ApiParam({ name: 'id', description: 'Assignment UUID' })
  @ApiResponse({ status: 201, schema: { example: { ok: true, notified: 25 } } })
  publish(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: User) {
    return this.svc.publish(id, user);
  }

  @Post(':id/unpublish')
  @Roles(UserRole.ADMIN, UserRole.TEACHER)
  @ApiOperation({ summary: 'Unpublish assignment (hides from students)' })
  @ApiParam({ name: 'id', description: 'Assignment UUID' })
  unpublish(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: User) {
    return this.svc.unpublish(id, user);
  }

  @Delete(':id')
  @Roles(UserRole.ADMIN, UserRole.TEACHER)
  @ApiOperation({ summary: 'Delete assignment (draft only)' })
  @ApiParam({ name: 'id', description: 'Assignment UUID' })
  remove(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: User) {
    return this.svc.remove(id, user);
  }

  // ── Teacher: view submissions ──────────────────────────────────────────────

  @Get('teacher/mine')
  @Roles(UserRole.ADMIN, UserRole.TEACHER)
  @ApiOperation({ summary: 'List my assignments (teacher)', description: 'Returns all assignments created by the authenticated teacher, optionally filtered by class.' })
  @ApiQuery({ name: 'classOfferingId', required: false, description: 'Filter by class offering UUID' })
  @ApiQuery({ name: 'termId', required: false, description: 'Filter by term UUID' })
  @ApiResponse({
    status: 200,
    schema: {
      example: [{
        id: 'uuid', title: 'Chapter 3 Worksheet', submissionType: 'file',
        deadline: '2026-05-15T23:59:00.000Z', maxScore: 100, published: true,
        subject: { name: 'Biology' }, grade: { name: 'Grade 9' }, section: { name: 'A' },
        isOverdue: false,
      }],
    },
  })
  listMine(@CurrentUser() user: User, @Query('classOfferingId') classOfferingId?: string, @Query('termId') termId?: string) {
    return this.svc.listForTeacher(user.id, classOfferingId, termId);
  }

  @Get(':id/submissions')
  @Roles(UserRole.ADMIN, UserRole.TEACHER)
  @ApiOperation({ summary: 'List all student submissions for an assignment' })
  @ApiParam({ name: 'id', description: 'Assignment UUID' })
  @ApiResponse({
    status: 200,
    schema: {
      example: [{
        id: 'uuid', status: 'submitted', submittedAt: '2026-05-10T14:00:00.000Z',
        score: null, feedback: null, releasedAt: null,
        student: { id: 'uuid', firstName: 'Ali', lastName: 'Hassan', email: 'ali@school.edu' },
        file: { id: 'uuid', filename: 'homework.pdf', mime: 'application/pdf', path: 'https://...' },
      }],
    },
  })
  listSubmissions(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: User) {
    return this.svc.listSubmissions(id, user);
  }

  @Post('submissions/:submissionId/grade')
  @Roles(UserRole.ADMIN, UserRole.TEACHER)
  @ApiOperation({ summary: 'Grade a student submission', description: 'Sets score and optional feedback. Call POST /submissions/:id/release to notify the student.' })
  @ApiParam({ name: 'submissionId', description: 'Submission UUID' })
  @ApiBody({ type: GradeSubmissionDto })
  @ApiResponse({ status: 201, description: 'Submission graded' })
  grade(@Param('submissionId', ParseUUIDPipe) submissionId: string, @Body() dto: GradeSubmissionDto, @CurrentUser() user: User) {
    return this.svc.gradeSubmission(submissionId, dto, user);
  }

  @Post('submissions/:submissionId/release')
  @Roles(UserRole.ADMIN, UserRole.TEACHER)
  @ApiOperation({ summary: 'Release grade to student', description: 'Notifies the student and auto-creates a grade ledger entry.' })
  @ApiParam({ name: 'submissionId', description: 'Submission UUID' })
  release(@Param('submissionId', ParseUUIDPipe) submissionId: string, @CurrentUser() user: User) {
    return this.svc.releaseGrade(submissionId, user);
  }

  @Post(':id/release-all')
  @Roles(UserRole.ADMIN, UserRole.TEACHER)
  @ApiOperation({ summary: 'Release all graded submissions at once' })
  @ApiParam({ name: 'id', description: 'Assignment UUID' })
  @ApiResponse({ status: 201, schema: { example: { released: 22 } } })
  releaseAll(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: User) {
    return this.svc.releaseAllGrades(id, user);
  }

  // ── Student / parent: view ─────────────────────────────────────────────────

  @Get('student/:studentId')
  @Roles(UserRole.ADMIN, UserRole.TEACHER, UserRole.STUDENT, UserRole.PARENT)
  @ApiOperation({
    summary: 'List assignments for a student',
    description: 'Returns all published assignments for the student\'s enrolled classes, with their submission status. Students see their own; parents see their linked child\'s.',
  })
  @ApiParam({ name: 'studentId', description: 'Student UUID' })
  @ApiQuery({ name: 'termId', required: false, description: 'Filter by term UUID' })
  @ApiResponse({
    status: 200,
    schema: {
      example: [{
        id: 'uuid', title: 'Chapter 3 Worksheet', submissionType: 'file',
        deadline: '2026-05-15T23:59:00.000Z', maxScore: 100, isOverdue: false,
        subject: { name: 'Biology' }, grade: { name: 'Grade 9' },
        submission: { id: 'uuid', status: 'submitted', submittedAt: '2026-05-10T14:00:00.000Z', score: null, releasedAt: null },
      }],
    },
  })
  listForStudent(@Param('studentId', ParseUUIDPipe) studentId: string, @CurrentUser() user: User, @Query('termId') termId?: string) {
    return this.svc.listForStudent(studentId, user, termId);
  }

  @Get(':id')
  @Roles(UserRole.ADMIN, UserRole.TEACHER, UserRole.STUDENT, UserRole.PARENT)
  @ApiOperation({ summary: 'Get assignment detail', description: 'Students also get their submission status.' })
  @ApiParam({ name: 'id', description: 'Assignment UUID' })
  getOne(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: User) {
    return this.svc.getOne(id, user);
  }

  // ── Student: submit ────────────────────────────────────────────────────────

  @Post(':id/submit')
  @Roles(UserRole.STUDENT)
  @ApiOperation({
    summary: 'Submit an assignment',
    description: 'For file submissions: upload via POST /files/upload first, then pass the fileId here. For text submissions: pass textContent.',
  })
  @ApiParam({ name: 'id', description: 'Assignment UUID' })
  @ApiBody({ type: SubmitAssignmentDto })
  @ApiResponse({ status: 201, description: 'Submission saved' })
  @ApiResponse({ status: 400, description: 'Deadline passed or wrong submission type' })
  submit(@Param('id', ParseUUIDPipe) id: string, @Body() dto: SubmitAssignmentDto, @CurrentUser() user: User) {
    return this.svc.submit(id, dto, user);
  }
}
