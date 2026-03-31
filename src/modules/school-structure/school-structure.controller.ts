import { Body, Controller, Delete, Get, Param, ParseUUIDPipe, Patch, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole } from '../users/entities/user.entity';
import { SchoolStructureService } from './school-structure.service';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNumber, IsOptional, IsString, MinLength } from 'class-validator';

class GradeBodyDto {
  @ApiProperty({ example: 'Grade 9' }) @IsString() @MinLength(1) name: string;
  @ApiPropertyOptional({ example: 9 }) @IsOptional() @IsNumber() orderIndex?: number;
}
class SectionBodyDto {
  @ApiProperty({ example: 'A' }) @IsString() @MinLength(1) name: string;
}
class SubjectBodyDto {
  @ApiProperty({ example: 'Mathematics' }) @IsString() @MinLength(1) name: string;
  @ApiPropertyOptional({ example: 'MATH101' }) @IsOptional() @IsString() code?: string;
}

@ApiTags('School structure')
@Controller()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN)
@ApiBearerAuth('JWT')
export class SchoolStructureController {
  constructor(private readonly svc: SchoolStructureService) {}

  @Get('grades')
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
