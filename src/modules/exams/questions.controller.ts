import { Body, Controller, Delete, Get, Param, ParseUUIDPipe, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiResponse, ApiTags } from '@nestjs/swagger';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, IsUUID, MinLength } from 'class-validator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole } from '../users/entities/user.entity';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { User } from '../users/entities/user.entity';
import { ExamsService } from './exams.service';

class QDto {
  @ApiProperty({ example: 'mcq', description: 'Question type: mcq | true_false | short_answer | essay' })
  @IsString()
  @MinLength(2)
  type: string;

  @ApiProperty({ description: 'Question text / stem' })
  @IsString()
  @MinLength(1)
  stem: string;

  @ApiPropertyOptional({ description: 'JSON array of answer options for MCQ' })
  @IsOptional()
  @IsString()
  optionsJson?: string;

  @ApiPropertyOptional({ description: 'Correct answer key (used for auto-grading MCQ/true_false)' })
  @IsOptional()
  @IsString()
  answerKey?: string;

  @ApiPropertyOptional({ description: 'JSON array of { fileId?, url?, kind?: "image" } attachments' })
  @IsOptional()
  @IsString()
  attachmentsJson?: string;

  @ApiProperty({ description: 'Subject UUID this question belongs to' })
  @IsUUID()
  subjectId: string;
}

@ApiTags('Exams')
@Controller('questions')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN, UserRole.TEACHER)
@ApiBearerAuth('JWT')
export class QuestionsController {
  constructor(private readonly exams: ExamsService) {}

  @Post()
  @ApiOperation({ summary: 'Create a question in the bank' })
  @ApiResponse({ status: 201, description: 'Question created' })
  create(@Body() dto: QDto, @CurrentUser() user: User) {
    return this.exams.createQuestion({ ...dto, createdById: user.id });
  }

  @Get()
  @ApiOperation({
    summary: 'List questions from the bank',
    description:
      'Supports filtering by `subjectId` directly or by `classOfferingId` (resolves to the class subject automatically). ' +
      'Returns paginated results with a `total` count for the frontend to build pagination.',
  })
  @ApiQuery({ name: 'subjectId', required: false, description: 'Filter by subject UUID' })
  @ApiQuery({ name: 'classOfferingId', required: false, description: 'Filter by class offering UUID (resolves to its subject)' })
  @ApiQuery({ name: 'skip', required: false, example: '0', description: 'Pagination offset' })
  @ApiQuery({ name: 'take', required: false, example: '30', description: 'Page size (max 100)' })
  @ApiResponse({
    status: 200,
    description: 'Paginated question list',
    schema: {
      example: {
        items: [{ id: 'uuid', type: 'mcq', stem: 'What is...', subject: { id: 'uuid', name: 'Biology' } }],
        total: 42,
        skip: 0,
        take: 30,
      },
    },
  })
  list(
    @Query('subjectId') subjectId?: string,
    @Query('classOfferingId') classOfferingId?: string,
    @Query('skip') skip?: string,
    @Query('take') take?: string,
  ) {
    const skipNum = skip ? parseInt(skip, 10) : 0;
    const takeNum = Math.min(take ? parseInt(take, 10) : 30, 100);
    return this.exams.listQuestions(subjectId, skipNum, takeNum);
  }

  @Delete(':id')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Delete a question (admin only)' })
  @ApiResponse({ status: 200, description: 'Question deleted' })
  @ApiResponse({ status: 404, description: 'Question not found' })
  async del(@Param('id', ParseUUIDPipe) id: string) {
    await this.exams.removeQuestion(id);
    return { ok: true };
  }
}
