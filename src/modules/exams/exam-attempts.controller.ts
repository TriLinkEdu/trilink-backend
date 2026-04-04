import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Header,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  Res,
  UseGuards,
} from '@nestjs/common';
import type { Response } from 'express';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { ApiProperty } from '@nestjs/swagger';
import { IsNumber, IsOptional, IsString } from 'class-validator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole } from '../users/entities/user.entity';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { User } from '../users/entities/user.entity';
import { ExamsService } from './exams.service';

class AnswersDto {
  @ApiProperty({ example: '{}' }) @IsString() answersJson: string;
}
class GradeDto {
  @ApiProperty({ example: 85, description: 'Final score; must be between 0 and the exam maxPoints (default 100, see PATCH /exams/:id).' })
  @IsNumber()
  score: number;
}
class ControlAttemptDto {
  @ApiProperty({ enum: ['force_submit', 'warn'] })
  @IsString()
  action: 'force_submit' | 'warn';

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  message?: string;
}
class ViolationDto {
  @ApiProperty({ example: 'Tab switch detected' })
  @IsString()
  reason: string;

  @ApiProperty({ required: false, description: 'ISO timestamp of when violation occurred' })
  @IsOptional()
  @IsString()
  timestamp?: string;
}

@ApiTags('Exams')
@Controller('attempts')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth('JWT')
export class ExamAttemptsController {
  constructor(private readonly exams: ExamsService) {}

  @Post(':id/answers')
  @Roles(UserRole.STUDENT)
  @ApiOperation({ summary: 'Autosave answers JSON' })
  save(@Param('id', ParseUUIDPipe) id: string, @Body() dto: AnswersDto) {
    return this.exams.saveAnswers(id, dto.answersJson);
  }

  @Post(':id/submit')
  @Roles(UserRole.STUDENT)
  submit(@Param('id', ParseUUIDPipe) id: string) {
    return this.exams.submit(id);
  }

  @Post(':id/grade')
  @Roles(UserRole.ADMIN, UserRole.TEACHER)
  grade(@Param('id', ParseUUIDPipe) id: string, @Body() dto: GradeDto, @CurrentUser() user: User) {
    return this.exams.grade(id, dto.score, user);
  }

  @Post(':id/release')
  @Roles(UserRole.ADMIN, UserRole.TEACHER)
  @ApiOperation({
    summary: 'Release result to student and parents',
    description:
      'First release notifies the student and linked parents; may auto-award badges. Only the exam creator (or admin) can release.',
  })
  release(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: User) {
    return this.exams.release(id, user);
  }

  @Post(':id/violations')
  @Roles(UserRole.STUDENT)
  @ApiOperation({ summary: 'Record a tab-switch / focus-loss violation during the exam' })
  async recordViolation(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ViolationDto,
  ) {
    await this.exams.recordViolation(id, dto.reason || 'Tab switch detected');
    return { ok: true };
  }

  @Get(':id/violations')
  @Roles(UserRole.ADMIN, UserRole.TEACHER)
  @ApiOperation({ summary: 'Get all recorded violations for an attempt (staff only)' })
  getViolations(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: User) {
    return this.exams.getViolations(id, user);
  }

  @Get(':id/for-grader')
  @Roles(UserRole.ADMIN, UserRole.TEACHER)
  @ApiOperation({
    summary: 'Full attempt for grading (answers + breakdown + violations)',
    description: 'Staff only. Works before or after release; includes parsed answers JSON and violations.',
  })
  forGrader(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: User) {
    return this.exams.getAttemptForGrader(id, user);
  }

  @Get(':id/result')
  @Roles(UserRole.STUDENT, UserRole.PARENT, UserRole.TEACHER, UserRole.ADMIN)
  @ApiOperation({
    summary: 'Released result with breakdown',
    description: 'Student sees own attempt; parent only if linked to that student; teacher/admin any.',
  })
  result(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: User) {
    return this.exams.getResult(id, user);
  }

  @Get(':id/export')
  @Roles(UserRole.STUDENT, UserRole.PARENT, UserRole.TEACHER, UserRole.ADMIN)
  @ApiOperation({ summary: 'Download single attempt result as CSV (released only; same access as result)' })
  @Header('Content-Type', 'text/csv; charset=utf-8')
  async exportAttempt(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: User,
    @Query('format') format: string,
    @Res({ passthrough: true }) res: Response,
  ) {
    if (format && format !== 'csv') throw new BadRequestException('Only format=csv is supported');
    const csv = await this.exams.exportAttemptCsv(id, user);
    res.setHeader('Content-Disposition', `attachment; filename="attempt-${id}.csv"`);
    return csv;
  }

  @Post(':id/control')
  @Roles(UserRole.ADMIN, UserRole.TEACHER)
  @ApiOperation({ summary: 'Teacher intervention: force submit or warn a student during an active exam' })
  controlAttempt(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ControlAttemptDto,
    @CurrentUser() user: User,
  ) {
    return this.exams.controlAttempt(id, dto.action, dto.message || '', user);
  }
}
