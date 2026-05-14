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
import { ApiBearerAuth, ApiOperation, ApiProperty, ApiQuery, ApiTags } from '@nestjs/swagger';
import { IsNumber, IsObject, IsOptional, IsString, MinLength } from 'class-validator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole } from '../users/entities/user.entity';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { User } from '../users/entities/user.entity';
import { GamificationService } from './gamification.service';
import { GamificationHubService } from './services/gamification-hub.service';

class CreateBadgeDto {
  @ApiProperty({ example: 'math_wizard' }) @IsString() @MinLength(2) key: string;
  @ApiProperty() @IsString() @MinLength(1) name: string;
  @ApiProperty({ required: false }) @IsOptional() @IsString() description?: string;
  @ApiProperty({ required: false }) @IsOptional() @IsString() iconKey?: string;
  @ApiProperty({ required: false }) @IsOptional() @IsNumber() pointsValue?: number;
}

class SubmitGamificationQuizDto {
  @ApiProperty({
    example: { 'q-1': 2, 'q-2': 1 },
    description: 'Map of questionId to selected option index',
  })
  @IsObject()
  @IsOptional()
  answers: Record<string, number>;
}

@ApiTags('Gamification')
@Controller('gamification')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth('JWT')
export class GamificationController {
  constructor(
    private readonly gam: GamificationService,
    private readonly hubService: GamificationHubService,
  ) {}

  // ── BFF Hub (replaces 10 parallel mobile requests) ────────────────────────

  @Get('hub')
  @Roles(UserRole.STUDENT)
  @ApiOperation({
    summary: 'Gamification Hub — full state payload',
    description:
      'Returns streak, XP, achievements, leaderboard, quizzes, missions, team challenge, ' +
      'and badges in a single round-trip. Use this instead of 10 individual endpoints.',
  })
  getHub(@CurrentUser() user: User) {
    return this.hubService.getHub(user);
  }

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
  @ApiQuery({ name: 'grade', required: false })
  @ApiQuery({ name: 'section', required: false })
  @ApiQuery({ name: 'subjectId', required: false })
  leaderboard(
    @CurrentUser() user: User,
    @Query('academicYearId') academicYearId: string,
    @Query('limit') limit?: string,
    @Query('grade') grade?: string,
    @Query('section') section?: string,
    @Query('subjectId') subjectId?: string,
  ) {
    if (!academicYearId) throw new BadRequestException('academicYearId query required');
    const n = parseInt(limit ?? '', 10);
    const take = Number.isFinite(n) ? n : 20;
    const effectiveGrade = user.role === UserRole.STUDENT ? user.grade : grade;
    const effectiveSection = user.role === UserRole.STUDENT ? undefined : section;
    return this.gam.leaderboardByExamAverage(
      academicYearId,
      take,
      effectiveGrade ?? undefined,
      effectiveSection,
      subjectId,
    );
  }

  @Get('leaderboard/xp')
  @Roles(UserRole.ADMIN, UserRole.TEACHER, UserRole.STUDENT, UserRole.PARENT)
  @ApiOperation({ summary: 'Leaderboard by XP (badge points)' })
  @ApiQuery({ name: 'period', required: false, example: 'weekly | monthly | all' })
  @ApiQuery({ name: 'grade', required: false })
  @ApiQuery({ name: 'section', required: false })
  leaderboardXp(
    @CurrentUser() user: User,
    @Query('period') period?: string,
    @Query('limit') limit?: string,
    @Query('grade') grade?: string,
    @Query('section') section?: string,
  ) {
    const n = parseInt(limit ?? '', 10);
    const take = Number.isFinite(n) ? n : 20;
    const normalized = (period ?? 'weekly').toLowerCase();
    const effectiveGrade = user.role === UserRole.STUDENT ? user.grade : grade;
    const effectiveSection = user.role === UserRole.STUDENT ? undefined : section;
    return this.gam.leaderboardByBadgePoints(
      normalized as 'weekly' | 'monthly' | 'all',
      take,
      effectiveGrade ?? undefined,
      effectiveSection,
    );
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

  @Get('me/streak')
  @Roles(UserRole.STUDENT, UserRole.PARENT, UserRole.TEACHER, UserRole.ADMIN)
  @ApiOperation({ summary: 'My login streak' })
  myStreak(@CurrentUser() user: User) {
    return this.gam.getLoginStreak(user.id);
  }

  @Get('me/progress')
  @Roles(UserRole.STUDENT, UserRole.PARENT, UserRole.TEACHER, UserRole.ADMIN)
  @ApiOperation({ summary: 'My combined gamification progress' })
  myProgress(@CurrentUser() user: User) {
    return this.gam.getMyProgress(user.id);
  }

  @Get('leaderboard/streaks')
  @Roles(UserRole.ADMIN, UserRole.TEACHER, UserRole.STUDENT, UserRole.PARENT)
  @ApiOperation({ summary: 'Leaderboard by current login streak' })
  @ApiQuery({ name: 'grade', required: false })
  @ApiQuery({ name: 'section', required: false })
  streakLeaderboard(
    @CurrentUser() user: User,
    @Query('limit') limit?: string,
    @Query('grade') grade?: string,
    @Query('section') section?: string,
  ) {
    const n = parseInt(limit ?? '', 10);
    const take = Number.isFinite(n) ? n : 20;
    const effectiveGrade = user.role === UserRole.STUDENT ? user.grade : grade;
    const effectiveSection = user.role === UserRole.STUDENT ? undefined : section;
    return this.gam.leaderboardStreaks(take, effectiveGrade ?? undefined, effectiveSection);
  }

  @Get('me/missions')
  @Roles(UserRole.STUDENT)
  @ApiOperation({ summary: 'List daily missions for current student' })
  missions(@CurrentUser() user: User) {
    return this.gam.listDailyMissions(user.id);
  }

  @Post('me/missions/:missionId/complete')
  @Roles(UserRole.STUDENT)
  @ApiOperation({ summary: 'Mark mission completed for current student' })
  completeMission(
    @CurrentUser() user: User,
    @Param('missionId') missionId: string,
  ) {
    return this.gam.completeMission(user.id, missionId);
  }

  @Get('me/team-challenge')
  @Roles(UserRole.STUDENT)
  @ApiOperation({ summary: 'Get current team challenge for student' })
  teamChallenge(@CurrentUser() user: User) {
    return this.gam.teamChallenge(user.id);
  }

  @Get('quizzes')
  @Roles(UserRole.STUDENT)
  @ApiOperation({ summary: 'List available gamification quizzes for current student' })
  quizzes(@CurrentUser() user: User) {
    return this.gam.listQuizzesForStudent(user);
  }

  @Get('achievements')
  @Roles(UserRole.ADMIN, UserRole.TEACHER, UserRole.STUDENT, UserRole.PARENT)
  @ApiOperation({ summary: 'List all achievements' })
  listAchievements() {
    return this.gam.listAchievements();
  }

  @Get('my-achievements')
  @Roles(UserRole.STUDENT)
  @ApiOperation({ summary: 'List current user achievements' })
  myAchievements(@CurrentUser() user: User) {
    return this.gam.listUserAchievements(user.id);
  }

  @Get('my-achievements/progress')
  @Roles(UserRole.STUDENT)
  @ApiOperation({ summary: 'List achievements with progress for current user' })
  myAchievementsProgress(@CurrentUser() user: User) {
    return this.gam.listAchievementsForUser(user.id);
  }

  @Post('check-achievements')
  @Roles(UserRole.STUDENT)
  @ApiOperation({ summary: 'Check and unlock new achievements' })
  checkAchievements(@CurrentUser() user: User) {
    return this.gam.checkAndUnlockAchievements(user.id);
  }

  @Get('quizzes/:id')
  @Roles(UserRole.STUDENT)
  @ApiOperation({ summary: 'Get quiz detail for current student' })
  quizById(@CurrentUser() user: User, @Param('id') id: string) {
    return this.gam.quizByIdForStudent(user, id);
  }

  @Post('quizzes/:id/submit')
  @Roles(UserRole.STUDENT)
  @ApiOperation({ summary: 'Submit quiz answers and apply gamification outcome' })
  submitQuiz(
    @CurrentUser() user: User,
    @Param('id') id: string,
    @Body() body: SubmitGamificationQuizDto,
  ) {
    return this.gam.submitQuizForStudent(user, id, body.answers || {});
  }
}
