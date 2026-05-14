import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiBody,
  ApiOperation,
  ApiParam,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { User, UserRole } from '../users/entities/user.entity';
import { ReportCardsService } from './report-cards.service';
import { CreateRemarkDto } from './dto/create-remark.dto';

@ApiTags('Report Cards')
@Controller('report-cards')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth('JWT')
export class ReportCardsController {
  constructor(private readonly svc: ReportCardsService) {}

  @Post('remarks')
  @Roles(UserRole.ADMIN, UserRole.TEACHER)
  @ApiOperation({
    summary: "Add or update homeroom teacher's remark for a student for a term",
    description:
      'Only the homeroom teacher for that student\'s class in the term\'s academic year can add remarks. Admins can always add remarks.',
  })
  @ApiBody({ type: CreateRemarkDto })
  @ApiResponse({ status: 201, description: 'Remark saved' })
  @ApiResponse({ status: 403, description: 'Not the homeroom teacher for this student' })
  upsertRemark(@Body() dto: CreateRemarkDto, @CurrentUser() user: User) {
    return this.svc.upsertRemark(dto, user);
  }

  @Get('student/:studentId/term/:termId')
  @Roles(UserRole.ADMIN, UserRole.TEACHER, UserRole.STUDENT, UserRole.PARENT)
  @ApiOperation({
    summary: 'Get full report card for a student for a term',
    description:
      'Returns the complete report card including all subjects, grades, attendance, GPA, and homeroom remark. ' +
      'Students can only view their own. Parents can only view their linked child.',
  })
  @ApiParam({ name: 'studentId', description: 'Student UUID' })
  @ApiParam({ name: 'termId', description: 'Term UUID' })
  @ApiResponse({
    status: 200,
    description: 'Full report card',
    schema: {
      example: {
        student: { id: 'uuid', firstName: 'Ali', lastName: 'Hassan', grade: 'Grade 9', section: 'A', profileImageFileId: null },
        academicYear: { id: 'uuid', label: '2025-2026' },
        term: { id: 'uuid', name: 'Term 1', startDate: '2025-09-01', endDate: '2025-12-15' },
        subjects: [
          {
            subjectId: 'uuid',
            subjectName: 'Mathematics',
            classOfferingId: 'uuid',
            teacherName: 'Jane Doe',
            entries: [{ title: 'Quiz 1', type: 'quiz', score: 88, maxScore: 100, percent: 88.0, releasedAt: '2025-10-01T00:00:00.000Z' }],
            summary: { totalEntries: 1, averagePercent: 88.0, letterGrade: 'B+' },
          },
        ],
        attendance: { present: 45, absent: 2, late: 1, excused: 0, total: 48, attendancePercent: 95.8 },
        overallGpa: 3.3,
        overallPercent: 88.0,
        overallLetterGrade: 'B+',
        homeroomRemark: { remark: 'Excellent student, keep it up!', conductGrade: 'A' },
        generatedAt: '2026-05-07T12:00:00.000Z',
      },
    },
  })
  @ApiResponse({ status: 403, description: 'Not allowed to view this student' })
  @ApiResponse({ status: 404, description: 'Student or term not found' })
  getStudentTermReportCard(
    @Param('studentId', ParseUUIDPipe) studentId: string,
    @Param('termId', ParseUUIDPipe) termId: string,
    @CurrentUser() user: User,
  ) {
    return this.svc.getStudentTermReportCard(studentId, termId, user);
  }

  @Get('class/:gradeId/:sectionId/term/:termId')
  @Roles(UserRole.ADMIN, UserRole.TEACHER)
  @ApiOperation({
    summary: 'Get report card summary for all students in a class for a term',
    description:
      'Returns a ranked list of all students with their overall percent, letter grade, and attendance. ' +
      'Teachers must be the homeroom teacher for that class.',
  })
  @ApiParam({ name: 'gradeId', description: 'Grade UUID' })
  @ApiParam({ name: 'sectionId', description: 'Section UUID' })
  @ApiParam({ name: 'termId', description: 'Term UUID' })
  @ApiResponse({
    status: 200,
    schema: {
      example: {
        gradeId: 'uuid',
        sectionId: 'uuid',
        termId: 'uuid',
        students: [
          { studentId: 'uuid', firstName: 'Ali', lastName: 'Hassan', overallPercent: 92.5, overallLetterGrade: 'A+', attendancePercent: 97.0, rank: 1 },
          { studentId: 'uuid', firstName: 'Sara', lastName: 'Ahmed', overallPercent: 88.0, overallLetterGrade: 'B+', attendancePercent: 95.0, rank: 2 },
        ],
      },
    },
  })
  @ApiResponse({ status: 403, description: 'Not the homeroom teacher for this class' })
  getClassTermReportCard(
    @Param('gradeId', ParseUUIDPipe) gradeId: string,
    @Param('sectionId', ParseUUIDPipe) sectionId: string,
    @Param('termId', ParseUUIDPipe) termId: string,
    @CurrentUser() user: User,
  ) {
    return this.svc.getClassTermReportCard(gradeId, sectionId, termId, user);
  }

  @Get('student/:studentId/academic-year/:academicYearId')
  @Roles(UserRole.ADMIN, UserRole.TEACHER, UserRole.STUDENT, UserRole.PARENT)
  @ApiOperation({
    summary: 'Get report cards for all terms in an academic year for a student',
    description:
      'Returns a full-year transcript view with per-term summaries. ' +
      'Students can only view their own. Parents can only view their linked child.',
  })
  @ApiParam({ name: 'studentId', description: 'Student UUID' })
  @ApiParam({ name: 'academicYearId', description: 'Academic year UUID' })
  @ApiResponse({ status: 200, description: 'Full-year transcript' })
  @ApiResponse({ status: 403, description: 'Not allowed to view this student' })
  @ApiResponse({ status: 404, description: 'Student or academic year not found' })
  getStudentYearReportCards(
    @Param('studentId', ParseUUIDPipe) studentId: string,
    @Param('academicYearId', ParseUUIDPipe) academicYearId: string,
    @CurrentUser() user: User,
  ) {
    return this.svc.getStudentYearReportCards(studentId, academicYearId, user);
  }
}
