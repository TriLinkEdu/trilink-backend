import {
  Body, Controller, Get, Param, ParseUUIDPipe,
  Post, Query, UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth, ApiBody, ApiOperation, ApiParam,
  ApiProperty, ApiPropertyOptional, ApiQuery, ApiResponse, ApiTags,
} from '@nestjs/swagger';
import { IsBoolean, IsInt, IsOptional, IsString, IsUUID, Max, Min, MinLength } from 'class-validator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole } from '../users/entities/user.entity';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { User } from '../users/entities/user.entity';
import { AiService } from './ai.service';

// ── DTOs ──────────────────────────────────────────────────────────────────────

class MasteryUpdateDto {
  @ApiProperty({ description: 'Student UUID' }) @IsUUID() student_id: string;
  @ApiProperty({ description: 'Topic UUID' }) @IsString() topic_id: string;
  @ApiProperty({ description: 'Whether the student answered correctly' }) @IsBoolean() is_correct: boolean;
}

class RecommendDto {
  @ApiProperty({ description: 'Student UUID' }) @IsUUID() student_id: string;
  @ApiProperty({ type: [String], description: 'List of weak topic IDs' }) weak_topic_ids: string[];
  @ApiPropertyOptional({ default: 'medium', description: 'easy | medium | hard' }) @IsOptional() @IsString() difficulty?: string;
  @ApiPropertyOptional({ default: 5, description: 'Max resources to return (1–20)' }) @IsOptional() @IsInt() @Min(1) @Max(20) limit?: number;
}

class LearningPathDto {
  @ApiProperty({ description: 'Student UUID' }) @IsUUID() student_id: string;
  @ApiProperty({ description: 'Subject UUID' }) @IsString() subject_id: string;
}

class GenerateLessonDto {
  @ApiProperty({ description: 'Topic UUID to generate a lesson for' }) @IsString() topic_id: string;
}

class GenerateQuestionsDto {
  @ApiProperty({ description: 'Topic UUID' }) @IsString() topic_id: string;
  @ApiPropertyOptional({ default: 5, description: 'Number of questions to generate (1–20)' }) @IsOptional() @IsInt() @Min(1) @Max(20) count?: number;
}

class ChatDto {
  @ApiProperty({ description: 'Student UUID' }) @IsUUID() student_id: string;
  @ApiProperty({ description: 'Student message / question' }) @IsString() @MinLength(1) message: string;
  @ApiPropertyOptional({ default: 9, description: 'Grade level for context' }) @IsOptional() @IsInt() @Min(1) @Max(12) grade_level?: number;
}

class FeedbackAssistantDto {
  @ApiProperty({ example: 'Email draft to parents about the field trip...' })
  @IsString() @MinLength(3) context: string;
  @ApiPropertyOptional({ example: 'teacher' }) @IsOptional() @IsString() audience?: string;
}

// ── Controller ────────────────────────────────────────────────────────────────

@ApiTags('AI')
@Controller('ai')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN, UserRole.TEACHER, UserRole.STUDENT, UserRole.PARENT)
@ApiBearerAuth('JWT')
export class AiController {
  constructor(private readonly ai: AiService) {}

  // ── Health ─────────────────────────────────────────────────────────────────

  @Get('health')
  @ApiOperation({ summary: 'AI service status', description: 'Returns whether AI_SERVICE_URL is configured and the service is reachable.' })
  @ApiResponse({ status: 200, description: 'Status object' })
  health() {
    return this.ai.health();
  }

  // ── Mastery ────────────────────────────────────────────────────────────────

  @Post('mastery/update')
  @ApiOperation({
    summary: 'Update student topic mastery (BKT)',
    description: 'Records a correct/incorrect answer and updates the Bayesian Knowledge Tracing mastery estimate for the student on that topic.',
  })
  @ApiBody({ type: MasteryUpdateDto })
  @ApiResponse({ status: 201, description: 'Updated mastery', schema: { example: { topic_id: 'uuid', old_mastery: 0.4, new_mastery: 0.62, assessment_count: 5, mastered: false } } })
  masteryUpdate(@Body() dto: MasteryUpdateDto, @CurrentUser() user: User) {
    return this.ai.masteryUpdate(dto, user);
  }

  @Get('mastery/:studentId/:topicId')
  @ApiOperation({ summary: 'Get mastery level for a student on a topic' })
  @ApiParam({ name: 'studentId', description: 'Student UUID' })
  @ApiParam({ name: 'topicId', description: 'Topic ID' })
  @ApiResponse({ status: 200, schema: { example: { topic_id: 'uuid', mastery_level: 0.72, assessment_count: 8, mastered: true } } })
  getMastery(
    @Param('studentId', ParseUUIDPipe) studentId: string,
    @Param('topicId') topicId: string,
    @CurrentUser() user: User,
  ) {
    return this.ai.getMastery(studentId, topicId, user);
  }

  @Get('mastery/:studentId/weak/:subjectId')
  @ApiOperation({
    summary: 'Get weak topics for a student in a subject',
    description: 'Returns topics where mastery is below threshold. Used to drive recommendations.',
  })
  @ApiParam({ name: 'studentId', description: 'Student UUID' })
  @ApiParam({ name: 'subjectId', description: 'Subject UUID' })
  @ApiResponse({ status: 200, schema: { example: { student_id: 'uuid', subject_id: 'uuid', weak_topics: [{ topic_id: 'uuid', mastery_level: 0.3 }] } } })
  getWeakTopics(
    @Param('studentId', ParseUUIDPipe) studentId: string,
    @Param('subjectId') subjectId: string,
    @CurrentUser() user: User,
  ) {
    return this.ai.getWeakTopics(studentId, subjectId, user);
  }

  // ── Recommendations ────────────────────────────────────────────────────────

  @Post('recommendations')
  @ApiOperation({
    summary: 'Get personalized resource recommendations',
    description: 'Given a list of weak topic IDs, returns ranked learning resources (videos, articles, exercises).',
  })
  @ApiBody({ type: RecommendDto })
  @ApiResponse({ status: 201, schema: { example: { student_id: 'uuid', resources: [{ type: 'video', title: 'Algebra basics', url: 'https://...', difficulty: 'medium' }] } } })
  recommend(@Body() dto: RecommendDto, @CurrentUser() user: User) {
    return this.ai.recommend(dto, user);
  }

  // Convenience GET wrapper (student self-serve)
  @Get('students/:studentId/recommendations')
  @ApiOperation({
    summary: 'Personalized recommendations for a student (GET convenience)',
    description: 'Resolves weak topics automatically from the student\'s mastery data, then returns recommendations.',
  })
  @ApiParam({ name: 'studentId', description: 'Student UUID' })
  @ApiQuery({ name: 'subjectId', required: false })
  @ApiQuery({ name: 'difficulty', required: false, example: 'medium' })
  @ApiQuery({ name: 'limit', required: false, example: '5' })
  recommendations(
    @Param('studentId', ParseUUIDPipe) studentId: string,
    @CurrentUser() user: User,
    @Query('subjectId') subjectId?: string,
    @Query('difficulty') difficulty?: string,
    @Query('limit') limit?: string,
  ) {
    return this.ai.recommendations(studentId, user, { subjectId, difficulty, limit: limit ? Number(limit) : undefined });
  }

  // ── Learning Path ──────────────────────────────────────────────────────────

  @Post('learning-path')
  @ApiOperation({
    summary: 'Generate adaptive learning path',
    description: 'Returns an ordered list of topics with mastery levels and completion status for a student in a subject.',
  })
  @ApiBody({ type: LearningPathDto })
  @ApiResponse({ status: 201, schema: { example: { student_id: 'uuid', subject_id: 'uuid', overall_progress: 0.45, topics: [{ topic_id: 'uuid', topic_name: 'Fractions', current_mastery: 0.3, target_mastery: 0.8, sequence_order: 1, is_completed: false, explanation: 'Start here' }] } } })
  learningPathPost(@Body() dto: LearningPathDto, @CurrentUser() user: User) {
    return this.ai.learningPathPost(dto, user);
  }

  // GET convenience wrapper
  @Get('students/:studentId/learning-path')
  @ApiOperation({ summary: 'Adaptive learning path (GET convenience)' })
  @ApiParam({ name: 'studentId', description: 'Student UUID' })
  @ApiQuery({ name: 'subjectId', required: false })
  learningPath(
    @Param('studentId', ParseUUIDPipe) studentId: string,
    @CurrentUser() user: User,
    @Query('subjectId') subjectId?: string,
  ) {
    return this.ai.learningPath(studentId, user, { subjectId });
  }

  // ── Content generation ─────────────────────────────────────────────────────

  @Post('content/generate-lesson')
  @ApiOperation({
    summary: 'Generate a lesson for a topic (AI)',
    description: 'Uses the configured LLM to generate a structured lesson resource for the given topic.',
  })
  @ApiBody({ type: GenerateLessonDto })
  @ApiResponse({ status: 201, schema: { example: { resource_id: 'uuid', title: 'Introduction to Fractions', topic_id: 'uuid', content: '...', needs_review: false, source: 'gemini' } } })
  generateLesson(@Body() dto: GenerateLessonDto, @CurrentUser() _user: User) {
    return this.ai.generateLesson(dto.topic_id);
  }

  @Post('content/generate-questions')
  @ApiOperation({
    summary: 'Generate quiz questions for a topic (AI)',
    description: 'Uses the configured LLM to generate MCQ/short-answer questions and persists them to the question bank.',
  })
  @ApiBody({ type: GenerateQuestionsDto })
  @ApiResponse({ status: 201, schema: { example: { topic_id: 'uuid', topic_name: 'Fractions', questions: [], saved: 5 } } })
  generateQuestions(@Body() dto: GenerateQuestionsDto, @CurrentUser() _user: User) {
    return this.ai.generateQuestions(dto.topic_id, dto.count ?? 5);
  }

  @Get('content/questions/:topicId')
  @ApiOperation({
    summary: 'Get persisted questions for a topic',
    description: 'Returns questions stored in the AI question bank for a topic. Used by NestJS to build quizzes.',
  })
  @ApiParam({ name: 'topicId', description: 'Topic ID' })
  @ApiQuery({ name: 'difficulty', required: false, description: 'easy | medium | hard' })
  @ApiQuery({ name: 'limit', required: false, example: '10' })
  getQuestions(
    @Param('topicId') topicId: string,
    @Query('difficulty') difficulty?: string,
    @Query('limit') limit?: string,
  ) {
    return this.ai.getQuestions(topicId, difficulty, limit ? Number(limit) : 10);
  }

  @Get('content/next-question/:studentId/:topicId')
  @ApiOperation({
    summary: 'Adaptive next question for a student on a topic',
    description: 'Selects a question at the appropriate difficulty based on the student\'s current BKT mastery level.',
  })
  @ApiParam({ name: 'studentId', description: 'Student UUID' })
  @ApiParam({ name: 'topicId', description: 'Topic ID' })
  nextQuestion(
    @Param('studentId', ParseUUIDPipe) studentId: string,
    @Param('topicId') topicId: string,
    @CurrentUser() user: User,
  ) {
    return this.ai.nextQuestion(studentId, topicId, user);
  }

  // ── Chat ───────────────────────────────────────────────────────────────────

  @Post('chat')
  @ApiOperation({
    summary: 'AI tutoring chat',
    description: 'Student sends a message; the AI responds with a contextual answer and optional source references.',
  })
  @ApiBody({ type: ChatDto })
  @ApiResponse({ status: 201, schema: { example: { student_id: 'uuid', message: 'What is a fraction?', answer: 'A fraction represents...', sources: [] } } })
  chat(@Body() dto: ChatDto, @CurrentUser() user: User) {
    return this.ai.chat(dto, user);
  }

  @Get('chat/history/:studentId')
  @ApiOperation({
    summary: 'Chat history for a student',
    description: 'Returns recent AI chat messages for the student. Student can only view their own history.',
  })
  @ApiParam({ name: 'studentId', description: 'Student UUID' })
  @ApiQuery({ name: 'limit', required: false, example: '20' })
  chatHistory(
    @Param('studentId', ParseUUIDPipe) studentId: string,
    @CurrentUser() user: User,
    @Query('limit') limit?: string,
  ) {
    return this.ai.chatHistory(studentId, user, limit ? Number(limit) : 20);
  }

  // ── Analytics ──────────────────────────────────────────────────────────────

  @Get('analytics/student/:studentId/weekly-summary')
  @ApiOperation({
    summary: 'Weekly progress summary for a student (parent view)',
    description: 'AI-generated plain-language weekly report covering attendance, exam scores, and engagement.',
  })
  @ApiParam({ name: 'studentId', description: 'Student UUID' })
  @ApiResponse({ status: 200, schema: { example: { student_id: 'uuid', week: '2026-W17', summary: 'Ali attended 4/5 classes...', metrics: {} } } })
  weeklySummary(@Param('studentId', ParseUUIDPipe) studentId: string, @CurrentUser() user: User) {
    return this.ai.weeklySummary(studentId, user);
  }

  @Get('analytics/subject/:subjectId/at-risk')
  @Roles(UserRole.ADMIN, UserRole.TEACHER)
  @ApiOperation({
    summary: 'At-risk students in a subject (teacher view)',
    description: 'Returns students whose mastery or attendance is below threshold, sorted by risk score.',
  })
  @ApiParam({ name: 'subjectId', description: 'Subject UUID' })
  @ApiQuery({ name: 'limit', required: false, example: '50' })
  @ApiQuery({ name: 'offset', required: false, example: '0' })
  atRiskStudents(
    @Param('subjectId') subjectId: string,
    @CurrentUser() user: User,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ) {
    return this.ai.atRiskStudents(subjectId, user, Number(limit ?? 50), Number(offset ?? 0));
  }

  @Get('analytics/subject/:subjectId/class-performance')
  @Roles(UserRole.ADMIN, UserRole.TEACHER)
  @ApiOperation({
    summary: 'Per-topic class performance (teacher view)',
    description: 'Shows which topics the class is struggling with — useful for deciding what to re-teach.',
  })
  @ApiParam({ name: 'subjectId', description: 'Subject UUID' })
  @ApiQuery({ name: 'limit', required: false, example: '50' })
  @ApiQuery({ name: 'offset', required: false, example: '0' })
  classPerformance(
    @Param('subjectId') subjectId: string,
    @CurrentUser() user: User,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ) {
    return this.ai.classPerformance(subjectId, user, Number(limit ?? 50), Number(offset ?? 0));
  }

  // ── Evaluate (rules engine — no external AI needed) ────────────────────────

  @Get('students/:studentId/evaluate')
  @ApiOperation({
    summary: 'Student self-evaluation summary',
    description: 'Rules-engine summary from attendance, exam scores, and login streak. Works without AI_SERVICE_URL.',
  })
  @ApiParam({ name: 'studentId', description: 'Student UUID' })
  evaluate(@Param('studentId', ParseUUIDPipe) studentId: string, @CurrentUser() user: User) {
    return this.ai.evaluateMe(studentId, user);
  }

  // ── Feedback assistant ─────────────────────────────────────────────────────

  @Post('feedback-assistant')
  @Roles(UserRole.ADMIN, UserRole.TEACHER)
  @ApiOperation({ summary: 'AI tone/draft assist for teacher communications' })
  @ApiBody({ type: FeedbackAssistantDto })
  feedbackAssistant(@Body() body: FeedbackAssistantDto, @CurrentUser() user: User) {
    return this.ai.feedbackAssistant(body, user);
  }
}
