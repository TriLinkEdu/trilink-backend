import { Body, Controller, Delete, Get, Param, ParseUUIDPipe, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
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
  @ApiProperty({ example: 'mcq' }) @IsString() @MinLength(2) type: string;
  @ApiProperty() @IsString() @MinLength(1) stem: string;
  @ApiPropertyOptional() @IsOptional() @IsString() optionsJson?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() answerKey?: string;
  @ApiProperty() @IsUUID() subjectId: string;
}

@ApiTags('Exams')
@Controller('questions')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN, UserRole.TEACHER)
@ApiBearerAuth('JWT')
export class QuestionsController {
  constructor(private readonly exams: ExamsService) {}

  @Post()
  @ApiOperation({ summary: 'Create question' })
  create(@Body() dto: QDto, @CurrentUser() user: User) {
    return this.exams.createQuestion({ ...dto, createdById: user.id });
  }

  @Get()
  list(@Query('subjectId') subjectId?: string) {
    return this.exams.listQuestions(subjectId);
  }

  @Delete(':id')
  @Roles(UserRole.ADMIN)
  async del(@Param('id', ParseUUIDPipe) id: string) {
    await this.exams.removeQuestion(id);
    return { ok: true };
  }
}
