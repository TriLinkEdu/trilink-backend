import {
  BadGatewayException,
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ParentStudent } from '../parent-students/entities/parent-student.entity';
import { User, UserRole } from '../users/entities/user.entity';
import { AttendanceMark } from '../attendance/entities/attendance-mark.entity';
import { ExamAttempt } from '../exams/entities/exam-attempt.entity';
import { Exam } from '../exams/entities/exam.entity';
import { LoginStreak } from '../gamification/entities/login-streak.entity';
import { Enrollment } from '../enrollments/entities/enrollment.entity';
import { ClassOffering } from '../class-offerings/entities/class-offering.entity';

@Injectable()
export class AiService {
  private readonly requestTimeoutMs = 15_000;

  constructor(
    @InjectRepository(ParentStudent) private readonly psRepo: Repository<ParentStudent>,
    @InjectRepository(User) private readonly userRepo: Repository<User>,
    @InjectRepository(AttendanceMark) private readonly markRepo: Repository<AttendanceMark>,
    @InjectRepository(ExamAttempt) private readonly attRepo: Repository<ExamAttempt>,
    @InjectRepository(Exam) private readonly examRepo: Repository<Exam>,
    @InjectRepository(LoginStreak) private readonly streakRepo: Repository<LoginStreak>,
    @InjectRepository(Enrollment) private readonly enrollmentRepo: Repository<Enrollment>,
    @InjectRepository(ClassOffering) private readonly classOfferingRepo: Repository<ClassOffering>,
  ) {}

  // ── Internal helpers ───────────────────────────────────────────────────────

  private aiBaseUrl(): string | null {
    const raw = (process.env.AI_SERVICE_URL || '').trim();
    if (!raw) return null;
    return raw.endsWith('/') ? raw.slice(0, -1) : raw;
  }

  private aiHeaders(contentType = true): Record<string, string> {
    const h: Record<string, string> = {};
    if (contentType) h['Content-Type'] = 'application/json';
    const key = (process.env.INTERNAL_API_KEY || '').trim();
    if (key) h['X-API-Key'] = key;
    return h;
  }

  private async fetchAi<T>(path: string, init?: RequestInit): Promise<T> {
    const baseUrl = this.aiBaseUrl();
    if (!baseUrl) throw new BadRequestException('AI service is not configured. Set AI_SERVICE_URL.');

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.requestTimeoutMs);
    try {
      const res = await fetch(`${baseUrl}${path}`, {
        ...init,
        headers: {
          ...this.aiHeaders(init?.method !== 'GET'),
          ...(init?.headers as Record<string, string> | undefined),
        },
        signal: controller.signal,
      });
      if (!res.ok) {
        const detail = await res.text().catch(() => 'AI service request failed');
        throw new BadGatewayException(`AI service error ${res.status}: ${detail}`);
      }
      return (await res.json()) as T;
    } catch (err) {
      if (err instanceof BadGatewayException || err instanceof BadRequestException) throw err;
      throw new BadGatewayException('Unable to reach AI service');
    } finally {
      clearTimeout(timeout);
    }
  }

  async assertCanAccessStudent(viewer: User, studentId: string) {
    if (viewer.role === UserRole.ADMIN || viewer.role === UserRole.TEACHER) return;
    if (viewer.role === UserRole.STUDENT && viewer.id === studentId) return;
    if (viewer.role === UserRole.PARENT) {
      const link = await this.psRepo.findOne({ where: { parentId: viewer.id, studentId } });
      if (link) return;
    }
    throw new ForbiddenException('Cannot access this student');
  }

  private async resolveSubjectId(studentId: string, subjectId?: string): Promise<string> {
    if (subjectId?.trim()) return subjectId.trim();
    const enrollment = await this.enrollmentRepo.findOne({ where: { studentId, status: 'active' }, order: { createdAt: 'DESC' } });
    if (!enrollment) throw new BadRequestException('subjectId is required — student has no active enrollment to infer from');
    const offering = await this.classOfferingRepo.findOne({ where: { id: enrollment.classOfferingId } });
    if (!offering) throw new BadRequestException('subjectId is required — class offering could not be resolved');
    return offering.subjectId;
  }

  // ── Health ─────────────────────────────────────────────────────────────────

  health() {
    const aiUrl = this.aiBaseUrl();
    if (!aiUrl) {
      return { status: 'not_configured', integration: 'pending', message: 'Set AI_SERVICE_URL and INTERNAL_API_KEY to enable AI features.' };
    }
    return { status: 'configured', integration: 'external_service', aiServiceUrl: aiUrl };
  }

  // ── Mastery ────────────────────────────────────────────────────────────────

  async masteryUpdate(dto: { student_id: string; topic_id: string; is_correct: boolean }, viewer: User) {
    await this.assertCanAccessStudent(viewer, dto.student_id);
    return this.fetchAi('/api/ai/mastery/update', {
      method: 'POST',
      body: JSON.stringify(dto),
    });
  }

  async getMastery(studentId: string, topicId: string, viewer: User) {
    await this.assertCanAccessStudent(viewer, studentId);
    return this.fetchAi(`/api/ai/mastery/${studentId}/${topicId}`, { method: 'GET' });
  }

  async getWeakTopics(studentId: string, subjectId: string, viewer: User) {
    await this.assertCanAccessStudent(viewer, studentId);
    return this.fetchAi(`/api/ai/mastery/${studentId}/weak/${subjectId}`, { method: 'GET' });
  }

  // ── Recommendations ────────────────────────────────────────────────────────

  async recommend(dto: { student_id: string; weak_topic_ids: string[]; difficulty?: string; limit?: number }, viewer: User) {
    await this.assertCanAccessStudent(viewer, dto.student_id);
    return this.fetchAi('/api/ai/recommendations', {
      method: 'POST',
      body: JSON.stringify({
        student_id: dto.student_id,
        weak_topic_ids: dto.weak_topic_ids,
        difficulty: dto.difficulty ?? 'medium',
        limit: Math.min(dto.limit ?? 5, 20),
      }),
    });
  }

  async recommendations(studentId: string, viewer: User, opts?: { subjectId?: string; difficulty?: string; limit?: number }) {
    await this.assertCanAccessStudent(viewer, studentId);
    const u = await this.userRepo.findOne({ where: { id: studentId } });

    const aiUrl = this.aiBaseUrl();
    if (!aiUrl) {
      return {
        studentId, source: 'not_configured',
        items: [],
        message: 'AI service is not configured. Set AI_SERVICE_URL to enable recommendations.',
        generatedAt: new Date().toISOString(),
        displayName: u ? `${u.firstName} ${u.lastName}` : null,
      };
    }

    const subjectId = await this.resolveSubjectId(studentId, opts?.subjectId);
    const weak = await this.fetchAi<{ weak_topics?: Array<{ topic_id: string }> }>(
      `/api/ai/mastery/${studentId}/weak/${subjectId}`, { method: 'GET' },
    );
    const weakTopicIds = (weak.weak_topics || []).map((t) => t.topic_id);

    const result = await this.fetchAi<{ resources?: Array<Record<string, unknown>> }>('/api/ai/recommendations', {
      method: 'POST',
      body: JSON.stringify({ student_id: studentId, weak_topic_ids: weakTopicIds, difficulty: opts?.difficulty ?? 'medium', limit: Math.min(opts?.limit ?? 5, 20) }),
    });

    return {
      studentId, subjectId, source: 'ai-service', weakTopicCount: weakTopicIds.length,
      items: (result.resources || []).map((r) => ({
        type: String(r.type ?? 'resource'), title: String(r.title ?? 'Untitled'),
        reason: String(r.source ?? 'ai_generated'), url: r.url ? String(r.url) : null,
        difficulty: r.difficulty ? String(r.difficulty) : null,
      })),
      generatedAt: new Date().toISOString(),
      displayName: u ? `${u.firstName} ${u.lastName}` : null,
    };
  }

  // ── Learning Path ──────────────────────────────────────────────────────────

  async learningPathPost(dto: { student_id: string; subject_id: string }, viewer: User) {
    await this.assertCanAccessStudent(viewer, dto.student_id);
    return this.fetchAi('/api/ai/learning-path', {
      method: 'POST',
      body: JSON.stringify(dto),
    });
  }

  async learningPath(studentId: string, viewer: User, opts?: { subjectId?: string }) {
    await this.assertCanAccessStudent(viewer, studentId);

    const aiUrl = this.aiBaseUrl();
    if (!aiUrl) {
      return {
        studentId, source: 'not_configured',
        weeks: [],
        topics: [],
        message: 'AI service is not configured. Set AI_SERVICE_URL to enable learning paths.',
        generatedAt: new Date().toISOString(),
      };
    }

    const subjectId = await this.resolveSubjectId(studentId, opts?.subjectId);
    const path = await this.fetchAi<{
      overall_progress?: number;
      topics?: Array<{ topic_id: string; topic_name: string; current_mastery: number; target_mastery: number; sequence_order: number; is_completed: boolean; explanation: string }>;
    }>('/api/ai/learning-path', {
      method: 'POST',
      body: JSON.stringify({ student_id: studentId, subject_id: subjectId }),
    });

    const topics = path.topics || [];
    return {
      studentId, subjectId, source: 'ai-service',
      overallProgress: path.overall_progress ?? null,
      topics,
      weeks: topics.map((t, idx) => ({ weekIndex: idx + 1, focus: t.topic_name, milestones: [t.explanation] })),
      generatedAt: new Date().toISOString(),
    };
  }

  // ── Content generation ─────────────────────────────────────────────────────

  async generateLesson(topicId: string) {
    return this.fetchAi('/api/ai/content/generate-lesson', {
      method: 'POST',
      body: JSON.stringify({ topic_id: topicId }),
    });
  }

  async generateQuestions(topicId: string, count: number) {
    return this.fetchAi('/api/ai/content/generate-questions', {
      method: 'POST',
      body: JSON.stringify({ topic_id: topicId, count }),
    });
  }

  async getQuestions(topicId: string, difficulty?: string, limit = 10) {
    const params = new URLSearchParams({ limit: String(limit) });
    if (difficulty) params.set('difficulty', difficulty);
    return this.fetchAi(`/api/ai/content/questions/${topicId}?${params.toString()}`, { method: 'GET' });
  }

  async nextQuestion(studentId: string, topicId: string, viewer: User) {
    await this.assertCanAccessStudent(viewer, studentId);
    return this.fetchAi(`/api/ai/content/next-question/${studentId}/${topicId}`, { method: 'GET' });
  }

  // ── Chat ───────────────────────────────────────────────────────────────────

  async chat(dto: { student_id: string; message: string; grade_level?: number }, viewer: User) {
    await this.assertCanAccessStudent(viewer, dto.student_id);

    const aiUrl = this.aiBaseUrl();
    if (!aiUrl) {
      return { source: 'not_configured', student_id: dto.student_id, message: dto.message, answer: null, sources: [], error: 'AI service is not configured. Set AI_SERVICE_URL.' };
    }

    return this.fetchAi('/api/ai/chat', {
      method: 'POST',
      body: JSON.stringify({ student_id: dto.student_id, message: dto.message, grade_level: dto.grade_level ?? 9 }),
    });
  }

  async chatHistory(studentId: string, viewer: User, limit = 20) {
    await this.assertCanAccessStudent(viewer, studentId);
    return this.fetchAi(`/api/ai/chat/history/${studentId}?limit=${Math.min(limit, 50)}`, { method: 'GET' });
  }

  // ── Analytics ──────────────────────────────────────────────────────────────

  async weeklySummary(studentId: string, viewer: User) {
    await this.assertCanAccessStudent(viewer, studentId);
    return this.fetchAi(`/api/ai/analytics/student/${studentId}/weekly-summary`, { method: 'GET' });
  }

  async atRiskStudents(subjectId: string, viewer: User, limit = 50, offset = 0) {
    if (viewer.role !== UserRole.ADMIN && viewer.role !== UserRole.TEACHER) {
      throw new ForbiddenException('Only teachers and admins can view at-risk analytics');
    }
    return this.fetchAi(`/api/ai/analytics/subject/${subjectId}/at-risk?limit=${limit}&offset=${offset}`, { method: 'GET' });
  }

  async classPerformance(subjectId: string, viewer: User, limit = 50, offset = 0) {
    if (viewer.role !== UserRole.ADMIN && viewer.role !== UserRole.TEACHER) {
      throw new ForbiddenException('Only teachers and admins can view class performance analytics');
    }
    return this.fetchAi(`/api/ai/analytics/subject/${subjectId}/class-performance?limit=${limit}&offset=${offset}`, { method: 'GET' });
  }

  // ── Evaluate (rules engine — works without AI_SERVICE_URL) ─────────────────

  async evaluateMe(studentId: string, viewer: User) {
    await this.assertCanAccessStudent(viewer, studentId);
    const u = await this.userRepo.findOne({ where: { id: studentId } });
    if (!u || u.role !== UserRole.STUDENT) throw new NotFoundException('Student not found');

    const marks = await this.markRepo.find({ where: { studentId } });
    let presentLike = 0;
    for (const m of marks) { if (m.status === 'present' || m.status === 'late') presentLike++; }
    const attendanceRate = marks.length > 0 ? presentLike / marks.length : null;

    const attempts = await this.attRepo.find({ where: { studentId }, order: { releasedAt: 'DESC' } });
    const released = attempts.filter((a) => a.releasedAt != null && a.score != null);
    const scores = released.map((a) => a.score!);
    const avgScore = scores.length > 0 ? Math.round((scores.reduce((x, y) => x + y, 0) / scores.length) * 100) / 100 : null;

    const streakRow = await this.streakRepo.findOne({ where: { userId: studentId } });
    const loginStreak = streakRow?.currentStreak ?? 0;

    let attendanceRating = 'no_data';
    if (attendanceRate != null) {
      if (attendanceRate >= 0.9) attendanceRating = 'excellent';
      else if (attendanceRate >= 0.75) attendanceRating = 'good';
      else attendanceRating = 'needs_improvement';
    }

    let academicSummary = 'No released exam results yet.';
    if (avgScore != null && released.length) {
      const lastExam = await this.examRepo.findOne({ where: { id: released[0].examId } });
      academicSummary = `Average score across ${released.length} released exam(s): ${avgScore}. Latest: ${lastExam?.title ?? 'Exam'}.`;
    }

    const strengths: string[] = [];
    const improvements: string[] = [];
    if (attendanceRate != null && attendanceRate >= 0.9) strengths.push('Strong attendance consistency.');
    else if (attendanceRate != null && attendanceRate >= 0.75) strengths.push('Decent attendance — keep it up!');
    else if (attendanceRate != null) improvements.push('Focus on attending every scheduled class.');
    if (avgScore != null && avgScore >= 80) strengths.push('Solid performance on released assessments.');
    else if (avgScore != null) improvements.push('Review feedback on past exams and ask teachers for clarification.');
    if (loginStreak >= 7) strengths.push('Great platform engagement streak.');
    if (strengths.length === 0 && marks.length === 0 && released.length === 0) {
      strengths.push('You are getting started — complete enrollments and assessments to unlock richer insights.');
    }

    return {
      studentId, source: 'rules_engine', generatedAt: new Date().toISOString(),
      metrics: {
        attendanceSessionsRecorded: marks.length,
        attendancePresentOrLateRate: attendanceRate != null ? Math.round(attendanceRate * 1000) / 1000 : null,
        releasedExamsCount: released.length,
        averageReleasedScore: avgScore,
        loginStreakDays: loginStreak,
      },
      attendanceRating, academicPerformanceSummary: academicSummary,
      strengths, areasForImprovement: improvements,
      disclaimer: 'Automated summary from TriLink data — not a substitute for teacher feedback.',
    };
  }

  // ── Feedback assistant ─────────────────────────────────────────────────────

  async feedbackAssistant(body: { context: string; audience?: string }, viewer: User) {
    const aiUrl = this.aiBaseUrl();
    if (!aiUrl) {
      return { source: 'not_configured', suggestion: null, inputEcho: body.context.slice(0, 200), audience: body.audience ?? 'teacher', error: 'AI service is not configured. Set AI_SERVICE_URL.' };
    }

    const chat = await this.fetchAi<{ answer?: string; sources?: unknown[] }>('/api/ai/chat', {
      method: 'POST',
      body: JSON.stringify({ student_id: viewer.id, message: body.context, grade_level: 9 }),
    });

    return {
      source: 'ai-service',
      suggestion: chat.answer || 'No suggestion returned.',
      inputEcho: body.context.slice(0, 200),
      audience: body.audience ?? 'teacher',
      sources: chat.sources || [],
    };
  }
}
