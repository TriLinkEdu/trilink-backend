import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post, Put, Query, UseGuards } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiTags,
  ApiPropertyOptional,
  ApiQuery,
  ApiParam,
  ApiResponse,
  ApiBody,
} from '@nestjs/swagger';
import { ApiProperty } from '@nestjs/swagger';
import { IsArray, IsString, IsUUID, ValidateNested, IsOptional } from 'class-validator';
import { Type } from 'class-transformer';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole } from '../users/entities/user.entity';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { User } from '../users/entities/user.entity';
import { AttendanceService } from './attendance.service';

class MarkRow {
  @ApiProperty({ description: 'Student UUID' }) @IsUUID() studentId: string;
  @ApiProperty({ example: 'present', description: 'present | absent | excused' }) @IsString() status: string;
  @ApiPropertyOptional({ description: 'Optional note for this mark' }) @IsOptional() @IsString() note?: string;
}

class BulkMarksDto {
  @ApiProperty({ type: [MarkRow], description: 'Array of student attendance marks' })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => MarkRow)
  marks: MarkRow[];
}

class EditMarkDto {
  @ApiPropertyOptional({ example: 'present', description: 'present | absent | excused' })
  @IsOptional()
  @IsString()
  status?: string;

  @ApiPropertyOptional({ description: 'Optional note' })
  @IsOptional()
  @IsString()
  note?: string;
}

class CreateSessionDto {
  @ApiProperty({ description: 'Class offering UUID' }) @IsUUID() classOfferingId: string;
  @ApiProperty({ example: '2026-04-22', description: 'Session date (YYYY-MM-DD)' }) @IsString() date: string;
  @ApiPropertyOptional({ description: 'Optional term UUID to tag this session' }) @IsOptional() @IsUUID() termId?: string;
}

@ApiTags('Attendance')
@Controller()
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth('JWT')
export class AttendanceController {
  constructor(private readonly svc: AttendanceService) {}

  // ─── Sessions ─────────────────────────────────────────────────────────────

  @Post('attendance-sessions')
  @Roles(UserRole.ADMIN, UserRole.TEACHER)
  @ApiOperation({
    summary: 'Create an attendance session',
    description: 'Teacher creates a session for one of their class offerings on a given date. Duplicate date+class is rejected.',
  })
  @ApiBody({ type: CreateSessionDto })
  @ApiResponse({ status: 201, description: 'Session created' })
  @ApiResponse({ status: 409, description: 'Session already exists for this date' })
  @ApiResponse({ status: 403, description: 'Teacher does not own this class' })
  createSession(
    @Body() body: CreateSessionDto,
    @CurrentUser() user: User,
  ) {
    return this.svc.createSession({ ...body, takenById: user.id, termId: body.termId ?? null }, user);
  }

  @Get('attendance-sessions')
  @Roles(UserRole.ADMIN, UserRole.TEACHER)
  @ApiOperation({
    summary: 'List sessions for a class offering',
    description: 'Returns all attendance sessions for the given classOfferingId, ordered by date descending.',
  })
  @ApiQuery({ name: 'classOfferingId', required: true, description: 'Class offering UUID' })
  @ApiResponse({ status: 200, description: 'List of sessions' })
  listSessions(@Query('classOfferingId') classOfferingId: string) {
    return this.svc.listSessions(classOfferingId);
  }

  @Get('attendance-sessions/my')
  @Roles(UserRole.TEACHER)
  @ApiOperation({
    summary: 'My attendance sessions (teacher)',
    description:
      'Returns all sessions across every class the authenticated teacher owns. ' +
      'Each session is enriched with subject name/code, grade, section, and teacher profile details.',
  })
  @ApiResponse({
    status: 200,
    description: 'Enriched session list',
    schema: {
      example: [
        {
          sessionId: 'uuid',
          date: '2026-04-22',
          createdAt: '2026-04-22T08:00:00.000Z',
          classOfferingId: 'uuid',
          className: 'Math 9A',
          subject: { id: 'uuid', name: 'Mathematics', code: 'MATH' },
          grade: { id: 'uuid', name: 'Grade 9' },
          section: { id: 'uuid', name: 'A' },
          teacher: { id: 'uuid', firstName: 'Jane', lastName: 'Doe', email: 'jane@school.edu', department: 'Science', officeRoom: '101' },
        },
      ],
    },
  })
  mySessionsAsTeacher(@CurrentUser() user: User) {
    return this.svc.listSessionsForTeacher(user);
  }

  // ─── Marks ────────────────────────────────────────────────────────────────

  @Put('attendance-sessions/:id/marks')
  @Roles(UserRole.ADMIN, UserRole.TEACHER)
  @ApiOperation({
    summary: 'Bulk upsert attendance marks for a session',
    description: 'Creates or updates a mark for each student in the payload. Only students enrolled in the session\'s class are accepted.',
  })
  @ApiParam({ name: 'id', description: 'Attendance session UUID' })
  @ApiBody({ type: BulkMarksDto })
  @ApiResponse({ status: 200, description: 'Saved marks returned' })
  @ApiResponse({ status: 400, description: 'Student not enrolled in this class' })
  @ApiResponse({ status: 403, description: 'Teacher does not own this class' })
  @ApiResponse({ status: 404, description: 'Session not found' })
  putMarks(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: BulkMarksDto,
    @CurrentUser() user: User,
  ) {
    return this.svc.putMarks(id, dto.marks, user);
  }

  @Get('attendance-sessions/:id/marks')
  @Roles(UserRole.ADMIN, UserRole.TEACHER)
  @ApiOperation({
    summary: 'Get all marks for a session',
    description: 'Returns raw mark rows (studentId, status, note) for the given session.',
  })
  @ApiParam({ name: 'id', description: 'Attendance session UUID' })
  @ApiResponse({ status: 200, description: 'List of marks' })
  @ApiResponse({ status: 404, description: 'Session not found' })
  getMarks(@Param('id', ParseUUIDPipe) id: string) {
    return this.svc.getMarks(id);
  }

  @Patch('attendance-marks/:markId')
  @Roles(UserRole.ADMIN, UserRole.TEACHER)
  @ApiOperation({
    summary: 'Edit a single attendance mark (teacher: own class only)',
    description: 'Update the status and/or note of an individual attendance mark. Teacher must own the class the session belongs to.',
  })
  @ApiParam({ name: 'markId', description: 'Attendance mark UUID' })
  @ApiResponse({ status: 200, description: 'Updated mark' })
  @ApiResponse({ status: 403, description: 'Teacher does not own this class' })
  @ApiResponse({ status: 404, description: 'Mark not found' })
  editMark(
    @Param('markId', ParseUUIDPipe) markId: string,
    @Body() dto: EditMarkDto,
    @CurrentUser() user: User,
  ) {
    return this.svc.editMark(markId, dto, user);
  }

  // ─── Reports ──────────────────────────────────────────────────────────────

  @Get('reports/attendance/student/:studentId/by-day')
  @Roles(UserRole.ADMIN, UserRole.TEACHER, UserRole.STUDENT, UserRole.PARENT)
  @ApiOperation({
    summary: 'Student attendance on a specific date (enriched)',
    description:
      'Returns every attendance record for the student on the given date. ' +
      'The top-level object includes the student\'s name and email. ' +
      'Each record includes mark status/note plus full class detail: subject name, grade, section, and teacher profile. ' +
      'Students can only query themselves; parents can only query their linked children.',
  })
  @ApiParam({ name: 'studentId', description: 'Student UUID' })
  @ApiQuery({ name: 'date', required: true, example: '2026-04-22', description: 'Date to retrieve (YYYY-MM-DD)' })
  @ApiResponse({
    status: 200,
    description: 'Attendance records for the day with student and class details',
    schema: {
      example: {
        studentId: 'uuid',
        firstName: 'Ali',
        lastName: 'Hassan',
        email: 'ali@school.edu',
        grade: 'Grade 9',
        section: 'A',
        date: '2026-04-22',
        records: [
          {
            markId: 'uuid',
            status: 'present',
            note: null,
            sessionId: 'uuid',
            classOfferingId: 'uuid',
            className: 'Math 9A',
            subject: { id: 'uuid', name: 'Mathematics', code: 'MATH' },
            grade: { id: 'uuid', name: 'Grade 9' },
            section: { id: 'uuid', name: 'A' },
            teacher: { id: 'uuid', firstName: 'Jane', lastName: 'Doe', email: 'jane@school.edu', department: 'Science', officeRoom: '101' },
          },
        ],
      },
    },
  })
  @ApiResponse({ status: 403, description: 'Not allowed to view this student' })
  repStudentByDay(
    @Param('studentId', ParseUUIDPipe) studentId: string,
    @CurrentUser() user: User,
    @Query('date') date: string,
  ) {
    return this.svc.reportStudentByDay(studentId, user, date);
  }

  @Get('reports/attendance/student/:studentId')
  @Roles(UserRole.ADMIN, UserRole.TEACHER, UserRole.STUDENT, UserRole.PARENT)
  @ApiOperation({
    summary: 'Full attendance history for a student (enriched)',
    description: 'Returns all attendance marks for the student across all sessions, sorted by date descending. Students can only query themselves; parents can only query their linked children.',
  })
  @ApiParam({ name: 'studentId', description: 'Student UUID' })
  @ApiResponse({ status: 200, description: 'Full attendance history with student and class details' })
  @ApiResponse({ status: 403, description: 'Not allowed to view this student' })
  repStudent(@Param('studentId', ParseUUIDPipe) studentId: string, @CurrentUser() user: User) {
    return this.svc.reportStudent(studentId, user);
  }

  @Get('reports/attendance/student/:studentId/by-subject/:subjectId')
  @Roles(UserRole.ADMIN, UserRole.TEACHER, UserRole.STUDENT, UserRole.PARENT)
  @ApiOperation({
    summary: 'Attendance for a student filtered by subject',
    description:
      'Returns all attendance sessions for the student in a specific subject, with per-session status and a summary (total, present, absent, excused, attendanceRate%). ' +
      'Students can only view their own. Parents can only view their linked child. ' +
      'Use GET /enrollments/mine/subjects or GET /enrollments/children/:studentId/subjects to get subject IDs.',
  })
  @ApiParam({ name: 'studentId', description: 'Student UUID' })
  @ApiParam({ name: 'subjectId', description: 'Subject UUID' })
  @ApiResponse({
    status: 200,
    schema: {
      example: {
        studentId: 'uuid', firstName: 'Ali', lastName: 'Hassan',
        subjectId: 'uuid', subjectName: 'Biology',
        summary: { total: 20, present: 17, absent: 2, excused: 1, attendanceRate: 90.0 },
        sessions: [
          {
            sessionId: 'uuid', date: '2026-04-22', status: 'present', note: null,
            classOfferingId: 'uuid', className: 'Biology 9A',
            subject: { id: 'uuid', name: 'Biology', code: 'Bio' },
            grade: { id: 'uuid', name: 'Grade 9' },
            section: { id: 'uuid', name: 'A' },
            teacher: { id: 'uuid', firstName: 'Abdu', lastName: 'Isa', email: 'abdu@school.edu', department: 'Science', officeRoom: null },
          },
        ],
      },
    },
  })
  @ApiResponse({ status: 403, description: 'Not allowed to view this student' })
  repStudentBySubject(
    @Param('studentId', ParseUUIDPipe) studentId: string,
    @Param('subjectId', ParseUUIDPipe) subjectId: string,
    @CurrentUser() user: User,
  ) {
    return this.svc.reportStudentBySubject(studentId, subjectId, user);
  }

  @Get('reports/attendance/class/:classOfferingId')
  @Roles(UserRole.ADMIN, UserRole.TEACHER)
  @ApiOperation({
    summary: 'Full attendance report for a class offering (enriched)',
    description:
      'Returns all sessions with their marks for the given class offering. ' +
      'The top-level includes subject, grade, section, and teacher details for the class. ' +
      'Each mark includes the student\'s name and email alongside the raw mark fields.',
  })
  @ApiParam({ name: 'classOfferingId', description: 'Class offering UUID' })
  @ApiResponse({
    status: 200,
    description: 'Class attendance report with student names and class details',
    schema: {
      example: {
        classOfferingId: 'uuid',
        className: 'Biology 9A',
        subject: { id: 'uuid', name: 'Biology', code: 'Bio' },
        grade: { id: 'uuid', name: 'Grade 9' },
        section: { id: 'uuid', name: 'A' },
        teacher: { id: 'uuid', firstName: 'Abdu', lastName: 'Isa', email: 'abdu@school.edu', department: 'Science', officeRoom: null },
        sessions: [
          {
            sessionId: 'uuid',
            date: '2026-04-04',
            marks: [
              {
                id: 'uuid',
                sessionId: 'uuid',
                studentId: 'uuid',
                studentFirstName: 'Ali',
                studentLastName: 'Hassan',
                studentEmail: 'ali@school.edu',
                status: 'present',
                note: null,
                createdAt: '2026-04-04T09:04:21.246Z',
              },
            ],
          },
        ],
      },
    },
  })
  repClass(@Param('classOfferingId', ParseUUIDPipe) classOfferingId: string) {
    return this.svc.reportClass(classOfferingId);
  }

  @Get('reports/attendance/student/:studentId/term/:termId')
  @Roles(UserRole.ADMIN, UserRole.TEACHER, UserRole.STUDENT, UserRole.PARENT)
  @ApiOperation({
    summary: 'Attendance summary for a student in a specific term',
    description:
      'Returns attendance counts (present, absent, late, excused) and per-session details for a student in a term. ' +
      'Matches sessions by termId or by date range if termId is not set on the session. ' +
      'Students can only view their own. Parents can only view their linked child.',
  })
  @ApiParam({ name: 'studentId', description: 'Student UUID' })
  @ApiParam({ name: 'termId', description: 'Term UUID' })
  @ApiResponse({
    status: 200,
    schema: {
      example: {
        studentId: 'uuid',
        firstName: 'Ali',
        lastName: 'Hassan',
        termId: 'uuid',
        termName: 'Term 1',
        present: 45,
        absent: 2,
        late: 1,
        excused: 0,
        total: 48,
        attendancePercent: 95.8,
        sessions: [
          { sessionId: 'uuid', date: '2025-11-01', classOfferingId: 'uuid', status: 'present', note: null },
        ],
      },
    },
  })
  @ApiResponse({ status: 403, description: 'Not allowed to view this student' })
  @ApiResponse({ status: 404, description: 'Term not found' })
  repStudentByTerm(
    @Param('studentId', ParseUUIDPipe) studentId: string,
    @Param('termId', ParseUUIDPipe) termId: string,
    @CurrentUser() user: User,
  ) {
    return this.svc.reportStudentByTerm(studentId, termId, user);
  }
}
