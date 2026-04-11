import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsEnum, IsOptional, IsString, IsUUID, MinLength } from 'class-validator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole } from '../users/entities/user.entity';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { User } from '../users/entities/user.entity';
import { FeedbackService } from './feedback.service';
import { FeedbackType } from './entities/feedback.entity';

class FCreate {
  @ApiProperty({ enum: FeedbackType, enumName: 'FeedbackType' })
  @IsEnum(FeedbackType)
  category: FeedbackType;
  @ApiProperty() @IsString() @MinLength(1) message: string;
  @ApiPropertyOptional() @IsOptional() @IsUUID() subjectId?: string;
  @ApiPropertyOptional() @IsOptional() @IsUUID() teacherId?: string;
  @ApiPropertyOptional({ description: 'Default true (anonymous). Set false to attach your identity.' })
  @IsOptional()
  @IsBoolean()
  isAnonymous?: boolean;
}
class FPatch {
  @ApiPropertyOptional() @IsOptional() @IsString() status?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() assigneeId?: string;
}

@ApiTags('Feedback')
@Controller('feedback')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth('JWT')
export class FeedbackController {
  constructor(private readonly svc: FeedbackService) {}

  @Post()
  @Roles(UserRole.STUDENT, UserRole.PARENT, UserRole.TEACHER)
  @ApiOperation({ summary: 'Submit feedback (anonymous by default)' })
  create(@Body() dto: FCreate, @CurrentUser() user: User) {
    return this.svc.create({
      authorId: user.id,
      category: dto.category,
      message: dto.message,
      subjectId: dto.subjectId,
      teacherId: dto.teacherId,
      isAnonymous: dto.isAnonymous,
    });
  }

  @Get('for-teacher')
  @Roles(UserRole.TEACHER)
  @ApiOperation({ summary: 'Anonymous feedback directed at this teacher' })
  forTeacher(@CurrentUser() user: User) {
    return this.svc.listForTeacher(user.id);
  }

  @Get()
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'List all feedback (author hidden when anonymous)' })
  list(
    @Query('subjectId', new ParseUUIDPipe({ optional: true })) subjectId?: string,
    @Query('teacherId', new ParseUUIDPipe({ optional: true })) teacherId?: string,
  ) {
    return this.svc.list({ subjectId, teacherId });
  }

  @Patch(':id')
  @Roles(UserRole.ADMIN)
  patch(@Param('id', ParseUUIDPipe) id: string, @Body() dto: FPatch) {
    return this.svc.update(id, dto);
  }
}
