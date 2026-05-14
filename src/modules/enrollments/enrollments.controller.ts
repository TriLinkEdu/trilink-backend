import { Body, Controller, Delete, Get, Param, ParseUUIDPipe, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiParam, ApiResponse, ApiTags } from '@nestjs/swagger';
import { ApiProperty } from '@nestjs/swagger';
import { IsArray, IsOptional, IsUUID } from 'class-validator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole } from '../users/entities/user.entity';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { User } from '../users/entities/user.entity';
import { EnrollmentsService } from './enrollments.service';

class EnrollDto {
  @ApiProperty() @IsUUID() studentId: string;
  @ApiProperty() @IsUUID() classOfferingId: string;
  @ApiProperty() @IsUUID() academicYearId: string;
}

class AssignStudentsToSectionDto {
  @ApiProperty({ required: false, description: 'Defaults to the active academic year if omitted' })
  @IsOptional()
  @IsUUID()
  academicYearId?: string;

  @ApiProperty() @IsUUID() gradeId: string;
  @ApiProperty() @IsUUID() sectionId: string;
  @ApiProperty({ type: [String], description: 'Student UUIDs to move into the section' })
  @IsArray()
  @IsUUID('4', { each: true })
  studentIds: string[];
}

class ClearStudentsSectionDto {
  @ApiProperty({ type: [String], description: 'Student UUIDs to clear section for' })
  @IsArray()
  @IsUUID('4', { each: true })
  studentIds: string[];
}

@ApiTags('Enrollments')
@Controller('enrollments')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth('JWT')
export class EnrollmentsController {
  constructor(private readonly svc: EnrollmentsService) {}

  @Get()
  @Roles(UserRole.ADMIN, UserRole.TEACHER)
  @ApiOperation({ summary: 'List enrollments (admin / teacher)' })
  list(
    @Query('studentId') studentId?: string,
    @Query('classOfferingId') classOfferingId?: string,
    @Query('academicYearId') academicYearId?: string,
  ) {
    return this.svc.list({ studentId, classOfferingId, academicYearId });
  }

  @Get('class/:classOfferingId/students')
  @Roles(UserRole.ADMIN, UserRole.TEACHER)
  @ApiOperation({
    summary: 'Student roster for a class offering (teacher)',
    description:
      'Returns all actively enrolled students in a class offering with their name, email, and profile details. ' +
      'Teachers can only query classes they teach; admins can query any.',
  })
  @ApiParam({ name: 'classOfferingId', description: 'Class offering UUID' })
  @ApiResponse({
    status: 200,
    schema: {
      example: {
        classOfferingId: 'uuid',
        className: 'Biology 9A',
        subject: { id: 'uuid', name: 'Biology', code: 'Bio' },
        grade: { id: 'uuid', name: 'Grade 9' },
        section: { id: 'uuid', name: 'A' },
        studentCount: 25,
        students: [
          { studentId: 'uuid', firstName: 'Ali', lastName: 'Hassan', email: 'ali@school.edu', enrollmentId: 'uuid' },
        ],
      },
    },
  })
  @ApiResponse({ status: 403, description: 'You do not teach this class' })
  classRoster(
    @Param('classOfferingId', ParseUUIDPipe) classOfferingId: string,
    @CurrentUser() user: User,
  ) {
    return this.svc.classRoster(classOfferingId, user);
  }

  @Get('mine')
  @Roles(UserRole.STUDENT)
  @ApiOperation({ summary: 'My active enrollments with class, subject, teacher' })
  mine(@CurrentUser() user: User) {
    return this.svc.listMine(user.id);
  }

  @Get('children/:studentId')
  @Roles(UserRole.PARENT)
  @ApiOperation({ summary: 'Linked child enrollments (subject / teacher detail)' })
  childEnrollments(@Param('studentId', ParseUUIDPipe) studentId: string, @CurrentUser() user: User) {
    return this.svc.listForParentChild(user.id, studentId);
  }

  @Get('children/:studentId/subjects')
  @Roles(UserRole.PARENT)
  @ApiOperation({
    summary: "Parent: get child's subject list",
    description: 'Returns all subjects the linked child is currently enrolled in, with teacher and class details.',
  })
  @ApiParam({ name: 'studentId', description: 'Student UUID' })
  @ApiResponse({
    status: 200,
    schema: {
      example: [
        {
          subjectId: 'uuid', subjectName: 'Biology', subjectCode: 'Bio',
          classOfferingId: 'uuid', gradeName: 'Grade 9', sectionName: 'A',
          teacher: { id: 'uuid', firstName: 'Abdu', lastName: 'Isa', email: 'abdu@school.edu' },
        },
      ],
    },
  })
  @ApiResponse({ status: 403, description: 'Not linked to this student' })
  childSubjects(@Param('studentId', ParseUUIDPipe) studentId: string, @CurrentUser() user: User) {
    return this.svc.listSubjectsForParentChild(user.id, studentId);
  }

  @Get('mine/subjects')
  @Roles(UserRole.STUDENT)
  @ApiOperation({
    summary: 'Student: get my subject list',
    description: 'Returns all subjects the authenticated student is currently enrolled in.',
  })
  @ApiResponse({
    status: 200,
    schema: {
      example: [
        {
          subjectId: 'uuid', subjectName: 'Biology', subjectCode: 'Bio',
          classOfferingId: 'uuid', gradeName: 'Grade 9', sectionName: 'A',
          teacher: { id: 'uuid', firstName: 'Abdu', lastName: 'Isa', email: 'abdu@school.edu' },
        },
      ],
    },
  })
  mySubjects(@CurrentUser() user: User) {
    return this.svc.listSubjectsForStudent(user.id);
  }

  @Post()
  @Roles(UserRole.ADMIN)
  create(@Body() dto: EnrollDto) {
    return this.svc.create(dto);
  }

  @Post('assign-section')
  @Roles(UserRole.ADMIN)
  @ApiOperation({
    summary: 'Assign students to a section and enroll them in all section class offerings',
    description:
      'Updates the selected students to the chosen grade/section and creates enrollments for every class offering in that section for the active academic year.',
  })
  assignSection(@Body() dto: AssignStudentsToSectionDto) {
    return this.svc.assignStudentsToSection(dto);
  }

  @Post('clear-section')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: "Clear students' section and remove their enrollments for that section" })
  clearSection(@Body() dto: ClearStudentsSectionDto) {
    return this.svc.clearStudentsSection(dto);
  }

  @Delete(':id')
  @Roles(UserRole.ADMIN)
  async del(@Param('id', ParseUUIDPipe) id: string) {
    await this.svc.remove(id);
    return { ok: true };
  }
}
