import { Body, Controller, Delete, Get, Param, ParseUUIDPipe, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole } from '../users/entities/user.entity';
import { SchoolStructureService } from './school-structure.service';
import { GradeSectionService } from './services/grade-section.service';
import { GradeSubjectService } from './services/grade-subject.service';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsArray, IsNumber, IsOptional, IsString, IsUUID, MinLength } from 'class-validator';

class GradeBodyDto {
  @ApiProperty({ example: 'Grade 9' }) @IsString() @MinLength(1) name: string;
  @ApiPropertyOptional({ example: 9 }) @IsOptional() @IsNumber() orderIndex?: number;
  @ApiPropertyOptional({ example: ['uuid1', 'uuid2'], description: 'Optional array of section IDs to assign to this grade' })
  @IsOptional()
  @IsArray()
  @IsUUID('4', { each: true })
  sectionIds?: string[];
  @ApiPropertyOptional({ example: ['uuid1', 'uuid2'], description: 'Optional array of subject IDs to assign to this grade' })
  @IsOptional()
  @IsArray()
  @IsUUID('4', { each: true })
  subjectIds?: string[];
}
class SectionBodyDto {
  @ApiProperty({ example: 'A' }) @IsString() @MinLength(1) name: string;
}
class SubjectBodyDto {
  @ApiProperty({ example: 'Mathematics' }) @IsString() @MinLength(1) name: string;
  @ApiPropertyOptional({ example: 'MATH101' }) @IsOptional() @IsString() code?: string;
}
class AssignSectionDto {
  @ApiProperty({ example: 'uuid' }) @IsUUID() sectionId: string;
}

/**
 * Handles /api/grades, /api/sections, /api/subjects (no prefix)
 * These are the existing CRUD routes the frontend already uses.
 */
@ApiTags('School structure')
@Controller()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN)
@ApiBearerAuth('JWT')
export class SchoolStructureController {
  constructor(
    private readonly svc: SchoolStructureService,
  ) {}
  @Get('grades')
  @Roles(UserRole.ADMIN, UserRole.TEACHER, UserRole.STUDENT, UserRole.PARENT)
  @ApiOperation({ summary: 'List grades' })
  grades() {
    return this.svc.gradesList();
  }
  @Post('grades')
  @ApiOperation({ summary: 'Create grade' })
  gradeCreate(@Body() body: GradeBodyDto) {
    return this.svc.gradeCreate(body);
  }
  @Patch('grades/:id')
  gradePatch(@Param('id', ParseUUIDPipe) id: string, @Body() body: Partial<GradeBodyDto>) {
    return this.svc.gradeUpdate(id, body);
  }
  @Delete('grades/:id')
  async gradeDel(@Param('id', ParseUUIDPipe) id: string) {
    await this.svc.gradeRemove(id);
    return { ok: true };
  }

  @Get('sections')
  @Roles(UserRole.ADMIN, UserRole.TEACHER, UserRole.STUDENT, UserRole.PARENT)
  sections() {
    return this.svc.sectionsList();
  }
  @Post('sections')
  sectionCreate(@Body() body: SectionBodyDto) {
    return this.svc.sectionCreate(body);
  }
  @Patch('sections/:id')
  sectionPatch(@Param('id', ParseUUIDPipe) id: string, @Body() body: SectionBodyDto) {
    return this.svc.sectionUpdate(id, body);
  }
  @Delete('sections/:id')
  async sectionDel(@Param('id', ParseUUIDPipe) id: string) {
    await this.svc.sectionRemove(id);
    return { ok: true };
  }

  @Get('subjects')
  @Roles(UserRole.ADMIN, UserRole.TEACHER, UserRole.STUDENT, UserRole.PARENT)
  subjects() {
    return this.svc.subjectsList();
  }
  @Post('subjects')
  subjectCreate(@Body() body: SubjectBodyDto) {
    return this.svc.subjectCreate(body);
  }
  @Patch('subjects/:id')
  subjectPatch(@Param('id', ParseUUIDPipe) id: string, @Body() body: Partial<SubjectBodyDto>) {
    return this.svc.subjectUpdate(id, body);
  }
  @Delete('subjects/:id')
  async subjectDel(@Param('id', ParseUUIDPipe) id: string) {
    await this.svc.subjectRemove(id);
    return { ok: true };
  }
}

/**
 * Handles /api/school-structure/grades/:gradeId/sections and subjects (with prefix)
 */
@ApiTags('School structure')
@Controller('school-structure')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN)
@ApiBearerAuth('JWT')
export class GradeSectionController {
  constructor(
    private readonly gradeSectionSvc: GradeSectionService,
    private readonly gradeSubjectSvc: GradeSubjectService,
  ) {}

  // --- Section endpoints ---
  @Post('grades/:gradeId/sections')
  @ApiOperation({ summary: 'Assign section to grade' })
  async assignSectionToGrade(
    @Param('gradeId', ParseUUIDPipe) gradeId: string,
    @Body() body: AssignSectionDto,
  ) {
    return this.gradeSectionSvc.assignSectionToGrade(gradeId, body.sectionId);
  }

  @Get('grades/:gradeId/sections')
  @ApiOperation({ summary: 'Get all sections for a grade' })
  async getSectionsForGrade(@Param('gradeId', ParseUUIDPipe) gradeId: string) {
    return this.gradeSectionSvc.getSectionsForGrade(gradeId);
  }

  @Get('grades/:gradeId/available-sections')
  @ApiOperation({ summary: 'Get available sections for class offering creation' })
  async getAvailableSections(
    @Param('gradeId', ParseUUIDPipe) gradeId: string,
    @Query('subjectId', ParseUUIDPipe) subjectId: string,
    @Query('academicYearId', ParseUUIDPipe) academicYearId: string,
  ) {
    return this.gradeSectionSvc.getAvailableSections(gradeId, subjectId, academicYearId);
  }

  @Delete('grades/:gradeId/sections/:sectionId')
  @ApiOperation({ summary: 'Remove section from grade' })
  async removeSectionFromGrade(
    @Param('gradeId', ParseUUIDPipe) gradeId: string,
    @Param('sectionId', ParseUUIDPipe) sectionId: string,
  ) {
    await this.gradeSectionSvc.removeSectionFromGrade(gradeId, sectionId);
    return { ok: true };
  }

  // --- Subject endpoints ---
  @Post('grades/:gradeId/subjects')
  @ApiOperation({ summary: 'Assign subject to grade' })
  async assignSubjectToGrade(
    @Param('gradeId', ParseUUIDPipe) gradeId: string,
    @Body() body: { subjectId: string },
  ) {
    return this.gradeSubjectSvc.assignSubjectToGrade(gradeId, body.subjectId);
  }

  @Get('grades/:gradeId/subjects')
  @ApiOperation({ summary: 'Get all subjects for a grade' })
  async getSubjectsForGrade(@Param('gradeId', ParseUUIDPipe) gradeId: string) {
    return this.gradeSubjectSvc.getSubjectsForGrade(gradeId);
  }

  @Delete('grades/:gradeId/subjects/:subjectId')
  @ApiOperation({ summary: 'Remove subject from grade' })
  async removeSubjectFromGrade(
    @Param('gradeId', ParseUUIDPipe) gradeId: string,
    @Param('subjectId', ParseUUIDPipe) subjectId: string,
  ) {
    await this.gradeSubjectSvc.removeSubjectFromGrade(gradeId, subjectId);
    return { ok: true };
  }
}
