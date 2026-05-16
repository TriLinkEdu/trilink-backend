import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiBody,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsArray,
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Min,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole } from '../users/entities/user.entity';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { User } from '../users/entities/user.entity';
import { GradesService } from './grades.service';
import { GradeEntryType } from './entities/grade-entry.entity';

class StudentScoreRow {
  @ApiProperty({ description: 'Student UUID' }) @IsUUID() studentId: string;
  @ApiPropertyOptional({ description: 'Score (null = not yet graded)' }) @IsOptional() @IsNumber() score?: number | null;
}

class BulkGradeDto {
  @ApiProperty({ description: 'Class offering UUID' }) @IsUUID() classOfferingId: string;
  @ApiProperty({ description: 'Grade entry title, e.g. "Assignment 1"' }) @IsString() title: string;
  @ApiProperty({ enum: GradeEntryType, enumName: 'GradeEntryType' }) @IsEnum(GradeEntryType) type: GradeEntryType;
  @ApiProperty({ description: 'Maximum possible score', example: 100 }) @IsNumber() @Min(1) maxScore: number;
  @ApiPropertyOptional({ description: 'Optional note for all entries' }) @IsOptional() @IsString() note?: string;
  @ApiProperty({ description: 'Term UUID to tag these entries' }) @IsUUID() termId: string;
  @ApiProperty({ type: [StudentScoreRow], description: 'One row per student' })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => StudentScoreRow)
  entries: StudentScoreRow[];
}

class CreateEntryDto {
  @ApiProperty() @IsUUID() classOfferingId: string;
  @ApiProperty() @IsUUID() studentId: string;
  @ApiProperty() @IsString() title: string;
  @ApiProperty({ enum: GradeEntryType, enumName: 'GradeEntryType' }) @IsEnum(GradeEntryType) type: GradeEntryType;
  @ApiPropertyOptional() @IsOptional() @IsNumber() score?: number | null;
  @ApiPropertyOptional({ default: 100 }) @IsOptional() @IsNumber() @Min(1) maxScore?: number;
  @ApiPropertyOptional() @IsOptional() @IsString() note?: string | null;
  @ApiProperty({ description: 'Term UUID to tag this entry' }) @IsUUID() termId: string;
}

class PatchEntryDto {
  @ApiPropertyOptional() @IsOptional() @IsString() title?: string;
  @ApiPropertyOptional({ enum: GradeEntryType }) @IsOptional() @IsEnum(GradeEntryType) type?: GradeEntryType;
  @ApiPropertyOptional() @IsOptional() @IsNumber() score?: number | null;
  @ApiPropertyOptional() @IsOptional() @IsNumber() @Min(1) maxScore?: number;
  @ApiPropertyOptional() @IsOptional() @IsString() note?: string | null;
}

class ReleaseDto {
  @ApiProperty({ description: 'Class offering UUID' }) @IsUUID() classOfferingId: string;
  @ApiProperty({ description: 'Title of the grade entry to release (releases all students for this title)' }) @IsString() title: string;
}

@ApiTags('Grades')
@Controller('grades')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth('JWT')
export class GradesController {
  constructor(private readonly svc: GradesService) {}

  // ── Teacher: create / manage ───────────────────────────────────────────────

  @Post('bulk')
  @Roles(UserRole.ADMIN, UserRole.TEACHER)
  @ApiOperation({
    summary: 'Bulk submit grades for all students in a class',
    description:
      'Submit scores for all students at once for a given title (e.g. "Assignment 1"). ' +
      'If an entry already exists for a student+title it will be updated. ' +
      'After submitting, call POST /grades/release to notify students.',
  })
  @ApiBody({ type: BulkGradeDto })
  @ApiResponse({ status: 201, description: 'Entries saved' })
  bulk(@Body() dto: BulkGradeDto, @CurrentUser() user: User) {
    return this.svc.bulkUpsertForClass(
      {
        classOfferingId: dto.classOfferingId,
        title: dto.title,
        type: dto.type,
        maxScore: dto.maxScore,
        note: dto.note,
        termId: dto.termId,
        entries: dto.entries.map((e) => ({ studentId: e.studentId, score: e.score ?? null })),
      },
      user,
    );
  }

  @Post()
  @Roles(UserRole.ADMIN, UserRole.TEACHER)
  @ApiOperation({
    summary: 'Create a single grade entry for one student',
    description: 'Use POST /grades/bulk to submit for all students at once.',
  })
  @ApiBody({ type: CreateEntryDto })
  @ApiResponse({ status: 201, description: 'Entry created' })
  create(@Body() dto: CreateEntryDto, @CurrentUser() user: User) {
    return this.svc.createEntry(
      {
        classOfferingId: dto.classOfferingId,
        studentId: dto.studentId,
        title: dto.title,
        type: dto.type,
        score: dto.score ?? null,
        maxScore: dto.maxScore ?? 100,
        note: dto.note ?? null,
        termId: dto.termId,
      },
      user,
    );
  }

  @Patch(':id')
  @Roles(UserRole.ADMIN, UserRole.TEACHER)
  @ApiOperation({
    summary: 'Update a grade entry',
    description: 'Edit score, maxScore, note, or title. Teacher can fold a score (e.g. change maxScore from 10 to 5).',
  })
  @ApiParam({ name: 'id', description: 'Grade entry UUID' })
  @ApiBody({ type: PatchEntryDto })
  @ApiResponse({ status: 200, description: 'Entry updated' })
  @ApiResponse({ status: 404, description: 'Entry not found' })
  update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: PatchEntryDto, @CurrentUser() user: User) {
    return this.svc.updateEntry(id, dto, user);
  }

  @Post('release')
  @Roles(UserRole.ADMIN, UserRole.TEACHER)
  @ApiOperation({
    summary: 'Release grades to students (sends notifications)',
    description:
      'Releases all entries for a given classOfferingId + title. ' +
      'Students and linked parents receive an in-app notification with their score.',
  })
  @ApiBody({ type: ReleaseDto })
  @ApiResponse({ status: 201, description: 'Grades released and notifications sent' })
  release(@Body() dto: ReleaseDto, @CurrentUser() user: User) {
    return this.svc.releaseEntries({ classOfferingId: dto.classOfferingId, title: dto.title }, user);
  }

  @Delete('group')
  @Roles(UserRole.ADMIN, UserRole.TEACHER)
  @HttpCode(200)
  @ApiOperation({
    summary: 'Delete an entire assessment (all entries with the given classOfferingId + title)',
  })
  @ApiBody({ type: ReleaseDto })
  @ApiResponse({ status: 200, description: 'Assessment deleted' })
  deleteGroup(@Body() dto: ReleaseDto, @CurrentUser() user: User) {
    return this.svc.deleteGroup({ classOfferingId: dto.classOfferingId, title: dto.title }, user);
  }

  @Delete(':id')
  @Roles(UserRole.ADMIN, UserRole.TEACHER)
  @HttpCode(200)
  @ApiOperation({ summary: 'Delete a single grade entry' })
  @ApiParam({ name: 'id', description: 'Grade entry UUID' })
  @ApiResponse({ status: 200, description: 'Entry deleted' })
  @ApiResponse({ status: 404, description: 'Entry not found' })
  deleteEntry(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: User) {
    return this.svc.deleteEntry(id, user);
  }

  // ── Teacher: view ─────────────────────────────────────────────────────────

  @Get('class/:classOfferingId')
  @Roles(UserRole.ADMIN, UserRole.TEACHER)
  @ApiOperation({
    summary: 'All grade entries for a class, grouped by title',
    description:
      'Returns each grade title (Assignment 1, Quiz 2, Midterm Exam, etc.) with the list of student scores. ' +
      'Platform exam submissions appear here automatically with type = exam.',
  })
  @ApiParam({ name: 'classOfferingId', description: 'Class offering UUID' })
  @ApiQuery({ name: 'termId', required: false, description: 'Filter by term UUID' })
  @ApiResponse({
    status: 200,
    schema: {
      example: {
        classOfferingId: 'uuid',
        groups: [
          {
            title: 'Assignment 1',
            type: 'assignment',
            maxScore: 100,
            releasedAt: null,
            studentCount: 25,
            entries: [
              { id: 'uuid', studentId: 'uuid', firstName: 'Ali', lastName: 'Hassan', score: 88, maxScore: 100, note: null, releasedAt: null },
            ],
          },
        ],
      },
    },
  })
  listForClass(
    @Param('classOfferingId', ParseUUIDPipe) classOfferingId: string,
    @Query('termId') termId: string | undefined,
    @CurrentUser() user: User,
  ) {
    return this.svc.listForClass(classOfferingId, user, termId);
  }

  // ── Student / parent: view ────────────────────────────────────────────────

  @Get('student/:studentId')
  @Roles(UserRole.ADMIN, UserRole.TEACHER, UserRole.STUDENT, UserRole.PARENT)
  @ApiOperation({
    summary: 'All released grades for a student',
    description: 'Students see only their own released grades. Parents see their linked child\'s released grades. Teachers/admin see all.',
  })
  @ApiParam({ name: 'studentId', description: 'Student UUID' })
  @ApiQuery({ name: 'classOfferingId', required: false, description: 'Filter by class (optional)' })
  listForStudent(@Param('studentId', ParseUUIDPipe) studentId: string, @CurrentUser() user: User) {
    return this.svc.listForStudent(studentId, user);
  }

  @Get('student/:studentId/by-subject/:subjectId')
  @Roles(UserRole.ADMIN, UserRole.TEACHER, UserRole.STUDENT, UserRole.PARENT)
  @ApiOperation({
    summary: 'Grades for a student filtered by subject',
    description:
      'Returns all released grade entries for the student in a specific subject, with a summary (total, average %). ' +
      'Students can only view their own. Parents can only view their linked child. ' +
      'Use GET /enrollments/mine/subjects or GET /enrollments/children/:studentId/subjects to get subject IDs.',
  })
  @ApiParam({ name: 'studentId', description: 'Student UUID' })
  @ApiParam({ name: 'subjectId', description: 'Subject UUID' })
  @ApiResponse({
    status: 200,
    schema: {
      example: {
        studentId: 'uuid',
        studentName: 'Ali Hassan',
        subjectId: 'uuid',
        subjectName: 'Biology',
        summary: { total: 5, withScore: 5, averagePercent: 82.4 },
        entries: [
          { id: 'uuid', title: 'Assignment 1', type: 'assignment', score: 88, maxScore: 100, releasedAt: '2026-04-20T10:00:00.000Z', note: null },
        ],
      },
    },
  })
  @ApiResponse({ status: 403, description: 'Not allowed to view this student' })
  listForStudentBySubject(
    @Param('studentId', ParseUUIDPipe) studentId: string,
    @Param('subjectId', ParseUUIDPipe) subjectId: string,
    @CurrentUser() user: User,
  ) {
    return this.svc.listForStudentBySubject(studentId, subjectId, user);
  }

  @Get('student/:studentId/term/:termId')
  @Roles(UserRole.ADMIN, UserRole.TEACHER, UserRole.STUDENT, UserRole.PARENT)
  @ApiOperation({
    summary: 'All released grade entries for a student filtered by term, grouped by subject',
    description:
      'Returns all grade entries tagged with the given termId for the student, grouped by subject. ' +
      'Students can only view their own. Parents can only view their linked child.',
  })
  @ApiParam({ name: 'studentId', description: 'Student UUID' })
  @ApiParam({ name: 'termId', description: 'Term UUID' })
  @ApiResponse({
    status: 200,
    schema: {
      example: {
        studentId: 'uuid',
        studentName: 'Ali Hassan',
        termId: 'uuid',
        subjects: [
          {
            subjectId: 'uuid',
            subjectName: 'Mathematics',
            entries: [
              { id: 'uuid', title: 'Quiz 1', type: 'quiz', score: 88, maxScore: 100, percent: 88.0, note: null, releasedAt: '2026-04-20T10:00:00.000Z' },
            ],
          },
        ],
      },
    },
  })
  @ApiResponse({ status: 403, description: 'Not allowed to view this student' })
  listForStudentByTerm(
    @Param('studentId', ParseUUIDPipe) studentId: string,
    @Param('termId', ParseUUIDPipe) termId: string,
    @CurrentUser() user: User,
  ) {
    return this.svc.listForStudentByTerm(studentId, termId, user);
  }
}
