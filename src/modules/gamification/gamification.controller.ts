import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiProperty, ApiTags } from '@nestjs/swagger';
import { IsNumber, IsOptional, IsString, MinLength } from 'class-validator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole } from '../users/entities/user.entity';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { User } from '../users/entities/user.entity';
import { GamificationService } from './gamification.service';

class CreateBadgeDto {
  @ApiProperty({ example: 'math_wizard' }) @IsString() @MinLength(2) key: string;
  @ApiProperty() @IsString() @MinLength(1) name: string;
  @ApiProperty({ required: false }) @IsOptional() @IsString() description?: string;
  @ApiProperty({ required: false }) @IsOptional() @IsString() iconKey?: string;
  @ApiProperty({ required: false }) @IsOptional() @IsNumber() pointsValue?: number;
}

@ApiTags('Gamification')
@Controller('gamification')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth('JWT')
export class GamificationController {
  constructor(private readonly gam: GamificationService) {}

  @Get('badges')
  @Roles(UserRole.ADMIN, UserRole.TEACHER, UserRole.STUDENT, UserRole.PARENT)
  @ApiOperation({ summary: 'List all badge definitions' })
  listBadges() {
    return this.gam.listBadges();
  }

  @Post('badges')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Create a badge' })
  createBadge(@Body() dto: CreateBadgeDto) {
    return this.gam.createBadge(dto);
  }

  @Post('users/:userId/badges/:badgeId')
  @Roles(UserRole.ADMIN, UserRole.TEACHER)
  @ApiOperation({ summary: 'Award a badge to a user' })
  award(
    @Param('userId', ParseUUIDPipe) userId: string,
    @Param('badgeId', ParseUUIDPipe) badgeId: string,
    @CurrentUser() user: User,
  ) {
    return this.gam.awardBadge(userId, badgeId, user.id);
  }

  @Get('me/badges')
  @Roles(UserRole.STUDENT, UserRole.PARENT, UserRole.TEACHER, UserRole.ADMIN)
  @ApiOperation({ summary: 'My awarded badges' })
  myBadges(@CurrentUser() user: User) {
    return this.gam.listUserBadges(user.id);
  }

  @Get('me/badge-points')
  @Roles(UserRole.STUDENT, UserRole.PARENT, UserRole.TEACHER, UserRole.ADMIN)
  @ApiOperation({ summary: 'Sum of points from my badges' })
  myPoints(@CurrentUser() user: User) {
    return this.gam.totalBadgePoints(user.id);
  }

  @Get('leaderboard/exam-average')
  @Roles(UserRole.ADMIN, UserRole.TEACHER, UserRole.STUDENT, UserRole.PARENT)
  @ApiOperation({
    summary: 'Leaderboard by average released exam score',
    description: 'Per academic year; motivates performance (scope: “leaderboard”).',
  })
  leaderboard(@Query('academicYearId') academicYearId: string, @Query('limit') limit?: string) {
    if (!academicYearId) throw new BadRequestException('academicYearId query required');
    return this.gam.leaderboardByExamAverage(academicYearId, limit ? parseInt(limit, 10) : 20);
  }

  @Get('students/:studentId/badges')
  @Roles(UserRole.ADMIN, UserRole.TEACHER, UserRole.STUDENT, UserRole.PARENT)
  @ApiOperation({ summary: 'Badges for a student (self, linked parent, staff)' })
  studentBadges(@Param('studentId', ParseUUIDPipe) studentId: string, @CurrentUser() user: User) {
    return this.gam.listUserBadgesForViewer(studentId, user);
  }

  @Get('students/:studentId/badge-points')
  @Roles(UserRole.ADMIN, UserRole.TEACHER, UserRole.STUDENT, UserRole.PARENT)
  studentPoints(@Param('studentId', ParseUUIDPipe) studentId: string, @CurrentUser() user: User) {
    return this.gam.totalBadgePointsForViewer(studentId, user);
  }
}
