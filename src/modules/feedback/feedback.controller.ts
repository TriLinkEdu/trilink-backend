import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post, Query, UseGuards } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiTags,
  ApiQuery,
  ApiParam,
  ApiResponse,
  ApiBody,
} from '@nestjs/swagger';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsEnum, IsOptional, IsString, IsUUID, MinLength } from 'class-validator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole } from '../users/entities/user.entity';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { User } from '../users/entities/user.entity';
import { FeedbackService } from './feedback.service';
import { FeedbackFilterService } from './services/feedback-filter.service';
import { FeedbackType, FeedbackSenderRole } from './entities/feedback.entity';

class FCreate {
  @ApiProperty({
    enum: FeedbackType,
    enumName: 'FeedbackType',
    description:
      '`teacher` = directed at a specific teacher (set teacherId). ' +
      '`school` = teacher sending feedback to school administration. ' +
      '`general` = any general feedback.',
  })
  @IsEnum(FeedbackType)
  category: FeedbackType;

  @ApiProperty({ description: 'Feedback message body', minLength: 1 })
  @IsString()
  @MinLength(1)
  message: string;

  @ApiPropertyOptional({ description: 'Subject UUID this feedback relates to (optional)' })
  @IsOptional()
  @IsUUID()
  subjectId?: string;

  @ApiPropertyOptional({ description: 'Teacher UUID this feedback is directed at. Required when category = teacher.' })
  @IsOptional()
  @IsUUID()
  teacherId?: string;

  @ApiPropertyOptional({
    default: true,
    description: 'When true (default) your identity is hidden. Set false to attach your name to the feedback.',
  })
  @IsOptional()
  @IsBoolean()
  isAnonymous?: boolean;
}

class FPatch {
  @ApiPropertyOptional({ description: 'New status value (e.g. open, in_progress, resolved)' })
  @IsOptional()
  @IsString()
  status?: string;

  @ApiPropertyOptional({ description: 'UUID of the admin/staff member assigned to handle this feedback' })
  @IsOptional()
  @IsString()
  assigneeId?: string;
}

@ApiTags('Feedback')
@Controller('feedback')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth('JWT')
export class FeedbackController {
  constructor(
    private readonly svc: FeedbackService,
    private readonly filterService: FeedbackFilterService,
  ) {}

  @Post()
  @Roles(UserRole.STUDENT, UserRole.PARENT, UserRole.TEACHER)
  @ApiOperation({
    summary: 'Submit feedback',
    description:
      'Any authenticated non-admin user can submit feedback. ' +
      'Feedback is anonymous by default (set `isAnonymous: false` to attach identity). ' +
      'Use `category: teacher` + `teacherId` to direct feedback at a specific teacher. ' +
      'Use `category: school` for teacher → school administration feedback.',
  })
  @ApiBody({ type: FCreate })
  @ApiResponse({ status: 201, description: 'Feedback submitted' })
  create(@Body() dto: FCreate, @CurrentUser() user: User) {
    return this.svc.create({
      authorId: user.id,
      authorRole: user.role,
      category: dto.category,
      message: dto.message,
      subjectId: dto.subjectId,
      teacherId: dto.teacherId,
      isAnonymous: dto.isAnonymous,
    });
  }

  @Get('mine')
  @Roles(UserRole.STUDENT, UserRole.PARENT, UserRole.TEACHER)
  @ApiOperation({
    summary: 'My submitted feedback',
    description:
      'Returns all feedback submitted by the authenticated user where `isAnonymous = false`. ' +
      'Anonymous submissions are excluded because no authorId is stored for them.',
  })
  @ApiResponse({
    status: 200,
    description: 'List of feedback submitted by the current user',
    schema: {
      example: [
        {
          id: 'uuid',
          authorId: 'uuid',
          senderRole: 'student',
          category: 'teacher',
          message: 'Great teaching style!',
          status: 'open',
          teacherId: 'uuid',
          subjectId: null,
          isAnonymous: false,
          createdAt: '2026-04-22T10:00:00.000Z',
        },
      ],
    },
  })
  mine(@CurrentUser() user: User) {
    return this.svc.listMine(user.id);
  }

  @Get('for-teacher')
  @Roles(UserRole.TEACHER)
  @ApiOperation({
    summary: 'Feedback directed at me (teacher)',
    description:
      'Returns all feedback where `category = teacher` and `teacherId` matches the authenticated teacher. ' +
      'Author identity is hidden when `isAnonymous = true`.',
  })
  @ApiResponse({
    status: 200,
    description: 'Feedback directed at this teacher',
    schema: {
      example: [
        {
          id: 'uuid',
          authorId: null,
          senderRole: 'student',
          category: 'teacher',
          message: 'Please slow down during explanations.',
          status: 'open',
          teacherId: 'uuid',
          subjectId: 'uuid',
          isAnonymous: true,
          createdAt: '2026-04-20T09:00:00.000Z',
        },
      ],
    },
  })
  forTeacher(@CurrentUser() user: User) {
    return this.svc.listForTeacher(user.id);
  }

  @Get('me')
  @Roles(UserRole.STUDENT, UserRole.PARENT, UserRole.TEACHER)
  @ApiOperation({ summary: 'My feedback history' })
  me(@CurrentUser() user: User) {
    return this.svc.listMine(user.id);
  }

  @Get()
  @Roles(UserRole.ADMIN)
  @ApiOperation({
    summary: 'List all feedback (admin)',
    description:
      'Returns all feedback with optional filters. Author identity is hidden when `isAnonymous = true`. ' +
      'Use `senderRole` to filter by who sent it (e.g. `teacher` to see all teacher→school feedback). ' +
      'Use `category` to filter by type. ' +
      'Additional filters: grade, section, dateFrom, dateTo for advanced filtering.',
  })
  @ApiQuery({ name: 'subjectId', required: false, description: 'Filter by subject UUID' })
  @ApiQuery({ name: 'teacherId', required: false, description: 'Filter by target teacher UUID' })
  @ApiQuery({ name: 'senderRole', required: false, enum: FeedbackSenderRole, description: 'Filter by sender role (student | parent | teacher)' })
  @ApiQuery({ name: 'category', required: false, enum: FeedbackType, description: 'Filter by feedback category (teacher | school | general)' })
  @ApiQuery({ name: 'grade', required: false, description: 'Filter by submitter grade' })
  @ApiQuery({ name: 'section', required: false, description: 'Filter by submitter section' })
  @ApiQuery({ name: 'dateFrom', required: false, description: 'Filter by date from (ISO 8601 format)' })
  @ApiQuery({ name: 'dateTo', required: false, description: 'Filter by date to (ISO 8601 format)' })
  @ApiResponse({ status: 200, description: 'Filtered feedback list' })
  async list(
    @Query('subjectId', new ParseUUIDPipe({ optional: true })) subjectId?: string,
    @Query('teacherId', new ParseUUIDPipe({ optional: true })) teacherId?: string,
    @Query('senderRole') senderRole?: FeedbackSenderRole,
    @Query('category') category?: FeedbackType,
    @Query('grade') grade?: string,
    @Query('section') section?: string,
    @Query('dateFrom') dateFrom?: string,
    @Query('dateTo') dateTo?: string,
  ) {
    // If advanced filters are provided, use the filter service
    if (grade || section || dateFrom || dateTo) {
      return this.filterService.filterFeedback({
        grade,
        section,
        dateFrom,
        dateTo,
        category,
        senderRole,
      });
    }

    // Otherwise, use the basic list method
    return this.svc.list({ subjectId, teacherId, senderRole, category });
  }

  @Patch(':id')
  @Roles(UserRole.ADMIN)
  @ApiOperation({
    summary: 'Update feedback status or assignee (admin)',
    description: 'Allows admin to change the status (e.g. open → resolved) or assign the feedback to a staff member.',
  })
  @ApiParam({ name: 'id', description: 'Feedback UUID' })
  @ApiBody({ type: FPatch })
  @ApiResponse({ status: 200, description: 'Updated feedback' })
  @ApiResponse({ status: 404, description: 'Feedback not found' })
  patch(@Param('id', ParseUUIDPipe) id: string, @Body() dto: FPatch) {
    return this.svc.update(id, dto);
  }
}
