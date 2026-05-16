import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Header,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  Res,
  UseGuards,
} from '@nestjs/common';
import type { Response } from 'express';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { ApiProperty } from '@nestjs/swagger';
import { IsArray, IsNumber, IsOptional, IsString, IsUUID, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole } from '../users/entities/user.entity';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { User } from '../users/entities/user.entity';
import { ExamsService } from './exams.service';

class ExamDto {
  @ApiProperty() @IsString() title: string;
  @ApiProperty() @IsUUID() academicYearId: string;
  @ApiProperty({ required: false }) @IsOptional() @IsUUID() classOfferingId?: string;
  @ApiProperty() @IsString() opensAt: string;
  @ApiProperty() @IsString() closesAt: string;
  @ApiProperty() @IsNumber() durationMinutes: number;
  @ApiProperty({ required: false, default: 0, description: 'Minimum number of minutes a student must stay before submit is allowed.' })
  @IsOptional()
  @IsNumber()
  minStayMinutes?: number;
  @ApiProperty({ required: false, default: 100, description: 'Scale for scores (auto + manual clamp to this)' })
  @IsOptional()
  @IsNumber()
  maxPoints?: number;
  @ApiProperty() @IsUUID() termId: string;
}

class PatchExamDto {
  @ApiProperty({ description: 'Grading scale (max score for this exam)' })
  @IsNumber()
  maxPoints: number;
}

class ExamQItem {
  @ApiProperty() @IsUUID() questionId: string;
  @ApiProperty() @IsNumber() orderIndex: number;
  @ApiProperty() @IsNumber() points: number;
}
class ExamQBody {
  @ApiProperty({ type: [ExamQItem] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ExamQItem)
  items: ExamQItem[];
}

@ApiTags('Exams')
@Controller('exams')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth('JWT')
export class ExamsController {
  constructor(private readonly exams: ExamsService) {}

  @Post()
  @Roles(UserRole.ADMIN, UserRole.TEACHER)
  @ApiOperation({ summary: 'Create exam draft' })
  create(@Body() dto: ExamDto, @CurrentUser() user: User) {
    const { termId, ...rest } = dto;
    return this.exams.createExam({
      title: rest.title,
      academicYearId: rest.academicYearId,
      classOfferingId: rest.classOfferingId ?? null,
      opensAt: new Date(rest.opensAt),
      closesAt: new Date(rest.closesAt),
      durationMinutes: rest.durationMinutes,
      minStayMinutes: rest.minStayMinutes,
      createdById: user.id,
      maxPoints: rest.maxPoints,
      termId: termId ?? null,
    });
  }

  @Get()
  @Roles(UserRole.ADMIN, UserRole.TEACHER, UserRole.STUDENT)
  @ApiOperation({
    summary: 'List exams',
    description:
      'Admin: all exams (optional year). Teacher: only exams they created. Student: only published exams.',
  })
  list(@CurrentUser() user: User, @Query('academicYearId') academicYearId: string | undefined, @Query('termId') termId?: string) {
    return this.exams.listExams(academicYearId, user, termId);
  }

  @Get(':id/attempts')
  @Roles(UserRole.ADMIN, UserRole.TEACHER)
  @ApiOperation({
    summary: 'List all student attempts for this exam (grading queue)',
    description: 'Includes submission status, scores, and needsManualGrading. Staff only.',
  })
  listAttempts(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: User) {
    return this.exams.listAttemptsForExam(id, user);
  }

  @Get(':id/results/export')
  @Roles(UserRole.ADMIN, UserRole.TEACHER)
  @ApiOperation({ summary: 'Download released results as CSV (all attempts)' })
  @Header('Content-Type', 'text/csv; charset=utf-8')
  async exportResults(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: User,
    @Query('format') format: string,
    @Res({ passthrough: true }) res: Response,
  ) {
    if (format && format !== 'csv') throw new BadRequestException('Only format=csv is supported');
    const csv = await this.exams.exportExamResultsCsv(id, user);
    res.setHeader('Content-Disposition', `attachment; filename="exam-${id}-results.csv"`);
    return csv;
  }

  @Patch(':id')
  @Roles(UserRole.ADMIN, UserRole.TEACHER)
  @ApiOperation({ summary: 'Update exam grading scale (maxPoints)' })
  patchExam(@Param('id', ParseUUIDPipe) id: string, @Body() dto: PatchExamDto, @CurrentUser() user: User) {
    return this.exams.updateExamMaxPoints(id, dto.maxPoints, user);
  }

  @Post(':id/questions')
  @Roles(UserRole.ADMIN, UserRole.TEACHER)
  addQs(@Param('id', ParseUUIDPipe) id: string, @Body() body: ExamQBody, @CurrentUser() user: User) {
    return this.exams.addQuestions(id, body.items, user);
  }

  @Get(':id/questions')
  @Roles(UserRole.ADMIN, UserRole.TEACHER, UserRole.STUDENT)
  listQs(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: User) {
    return this.exams.listExamQuestions(id, user);
  }

  @Post(':id/publish')
  @Roles(UserRole.ADMIN, UserRole.TEACHER)
  publish(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: User) {
    return this.exams.publish(id, user);
  }

  @Get(':id/students')
  @Roles(UserRole.ADMIN, UserRole.TEACHER)
  @ApiOperation({
    summary: 'Get student roster for this exam with attempt status and violation count',
    description: 'Returns enrolled students (class-scoped) or students with attempts, with status: not_started | in_progress | submitted.',
  })
  studentRoster(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: User) {
    return this.exams.getExamStudentRoster(id, user);
  }

  @Post(':id/attempts')
  @Roles(UserRole.STUDENT)
  startAttempt(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: User) {
    return this.exams.startAttempt(id, user.id);
  }
}
