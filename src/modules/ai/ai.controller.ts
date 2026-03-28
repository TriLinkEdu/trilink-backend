import { Body, Controller, Get, Param, ParseUUIDPipe, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiBody, ApiOperation, ApiProperty, ApiTags } from '@nestjs/swagger';
import { IsOptional, IsString, MinLength } from 'class-validator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole } from '../users/entities/user.entity';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { User } from '../users/entities/user.entity';
import { AiService } from './ai.service';

class FeedbackAssistantDto {
  @ApiProperty({ example: 'Email draft to parents about the field trip...' })
  @IsString()
  @MinLength(3)
  context: string;

  @ApiProperty({ required: false, example: 'teacher' })
  @IsOptional()
  @IsString()
  audience?: string;
}

@ApiTags('AI (stub)')
@Controller('ai')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN, UserRole.TEACHER, UserRole.STUDENT, UserRole.PARENT)
@ApiBearerAuth('JWT')
export class AiController {
  constructor(private readonly ai: AiService) {}

  @Get('health')
  @ApiOperation({ summary: 'AI integration status (stub)' })
  health() {
    return this.ai.health();
  }

  @Get('students/:studentId/recommendations')
  @ApiOperation({
    summary: 'Personalized resource recommendations (stub)',
    description: 'Student (self), linked parent, teacher, or admin.',
  })
  recommendations(@Param('studentId', ParseUUIDPipe) studentId: string, @CurrentUser() user: User) {
    return this.ai.recommendations(studentId, user);
  }

  @Get('students/:studentId/learning-path')
  @ApiOperation({
    summary: 'Adaptive learning path outline (stub)',
    description: 'Same access rules as recommendations.',
  })
  learningPath(@Param('studentId', ParseUUIDPipe) studentId: string, @CurrentUser() user: User) {
    return this.ai.learningPath(studentId, user);
  }

  @Post('feedback-assistant')
  @ApiOperation({ summary: 'Draft / tone assist for teacher communications (stub)' })
  @ApiBody({ type: FeedbackAssistantDto })
  feedbackAssistant(@Body() body: FeedbackAssistantDto) {
    return this.ai.feedbackAssistant(body);
  }
}
