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

/** Mock payloads until an external Python / ML service is integrated. */
@Injectable()
export class AiService {
  private readonly requestTimeoutMs = 12000;

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

  private aiBaseUrl(): string | null {
    const raw = (process.env.AI_SERVICE_URL || '').trim();
    if (!raw) return null;
    return raw.endsWith('/') ? raw.slice(0, -1) : raw;
  }

  private aiHeaders(contentType = true): Record<string, string> {
    const headers: Record<string, string> = {};
    if (contentType) headers['Content-Type'] = 'application/json';
    const key = (process.env.INTERNAL_API_KEY || '').trim();
    if (key) headers['X-API-Key'] = key;
    return headers;
  }

  private async fetchAi<T>(path: string, init?: RequestInit): Promise<T> {
    const baseUrl = this.aiBaseUrl();
    if (!baseUrl) {
      throw new BadRequestException('AI service is not configured. Set AI_SERVICE_URL.');
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.requestTimeoutMs);

    try {
      const res = await fetch(`${baseUrl}${path}`, {
        ...init,
        headers: {
          ...this.aiHeaders(!(init && init.method === 'GET')),
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
      if (err instanceof BadGatewayException) throw err;
      throw new BadGatewayException('Unable to reach AI service');
    } finally {
      clearTimeout(timeout);
    }
  }

  private async resolveSubjectId(studentId: string, subjectId?: string): Promise<string> {
    if (subjectId && subjectId.trim()) return subjectId.trim();

    const activeEnrollment = await this.enrollmentRepo.findOne({
      where: { studentId, status: 'active' },
      order: { createdAt: 'DESC' },
    });
    if (!activeEnrollment) {
      throw new BadRequestException('subjectId is required because student has no active enrollment to infer from');
    }

    const offering = await this.classOfferingRepo.findOne({ where: { id: activeEnrollment.classOfferingId } });
    if (!offering) {
      throw new BadRequestException('subjectId is required because class offering could not be resolved');
    }
    return offering.subjectId;
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

  health() {
    const aiUrl = this.aiBaseUrl();
    if (!aiUrl) {
      return {
        status: 'not_configured',
        integration: 'pending',
        message: 'Set AI_SERVICE_URL and INTERNAL_API_KEY to enable external AI integration.',
      };
    }
    return {
      status: 'configured',
      integration: 'external_service',
      aiServiceUrl: aiUrl,
      message: 'AI service URL configured. Use /api/ai/* routes to proxy requests.',
    };
  }

  async recommendations(
    studentId: string,
    viewer: User,
    opts?: { subjectId?: string; difficulty?: string; limit?: number },
  ) {
    await this.assertCanAccessStudent(viewer, studentId);
    const u = await this.userRepo.findOne({ where: { id: studentId } });

    const aiUrl = this.aiBaseUrl();
    if (!aiUrl) {
      return {
        studentId,
        source: 'stub',
        items: [
          {
            type: 'resource',
            title: 'Sample video: Algebra fundamentals',
            reason: 'AI service is not configured yet.',
            url: 'https://example.org/learn/algebra-intro',
          },
        ],
        generatedAt: new Date().toISOString(),
        displayName: u ? `${u.firstName} ${u.lastName}` : null,
      };
    }

    const subjectId = await this.resolveSubjectId(studentId, opts?.subjectId);
    const weak = await this.fetchAi<{ weak_topics?: Array<{ topic_id: string }> }>(
      `/api/ai/mastery/${studentId}/weak/${subjectId}`,
      { method: 'GET' },
    );
    const weakTopicIds = (weak.weak_topics || []).map((t) => t.topic_id);

    const recommended = await this.fetchAi<{ resources?: Array<Record<string, unknown>> }>(
      '/api/ai/recommendations',
      {
        method: 'POST',
        body: JSON.stringify({
          student_id: studentId,
          weak_topic_ids: weakTopicIds,
          difficulty: opts?.difficulty || 'medium',
          limit: opts?.limit && opts.limit > 0 ? Math.min(opts.limit, 20) : 5,
        }),
      },
    );

    return {
      studentId,
      subjectId,
      source: 'ai-service',
      weakTopicCount: weakTopicIds.length,
      items: (recommended.resources || []).map((r) => ({
        type: String(r.type ?? 'resource'),
        title: String(r.title ?? 'Untitled recommendation'),
        reason: String(r.source ?? 'ai_generated'),
        url: r.url ? String(r.url) : null,
        difficulty: r.difficulty ? String(r.difficulty) : null,
      })),
      generatedAt: new Date().toISOString(),
      displayName: u ? `${u.firstName} ${u.lastName}` : null,
    };
  }

  async learningPath(studentId: string, viewer: User, opts?: { subjectId?: string }) {
    await this.assertCanAccessStudent(viewer, studentId);

    const aiUrl = this.aiBaseUrl();
    if (!aiUrl) {
      return {
        studentId,
        source: 'stub',
        weeks: [
          { weekIndex: 1, focus: 'Review fractions', milestones: ['Diagnostic quiz', 'Short practice'] },
          { weekIndex: 2, focus: 'Linear equations', milestones: ['Video + worksheet'] },
        ],
        generatedAt: new Date().toISOString(),
      };
    }

    const subjectId = await this.resolveSubjectId(studentId, opts?.subjectId);
    const path = await this.fetchAi<{
      overall_progress?: number;
      topics?: Array<{
        topic_id: string;
        topic_name: string;
        current_mastery: number;
        target_mastery: number;
        sequence_order: number;
        is_completed: boolean;
        explanation: string;
      }>;
    }>('/api/ai/learning-path', {
      method: 'POST',
      body: JSON.stringify({ student_id: studentId, subject_id: subjectId }),
    });

    const topics = path.topics || [];

    return {
      studentId,
      subjectId,
      source: 'ai-service',
      overallProgress: path.overall_progress ?? null,
      topics,
      weeks: topics.map((t, idx) => ({
        weekIndex: idx + 1,
        focus: t.topic_name,
        milestones: [t.explanation],
      })),
      generatedAt: new Date().toISOString(),
    };
  }

  async feedbackAssistant(body: { context: string; audience?: string }, viewer: User) {
    const aiUrl = this.aiBaseUrl();
    if (!aiUrl) {
      return {
        source: 'stub',
        suggestion:
          'This is example AI copy. Wire POST body to your Python service; return structured tone checks and bullet suggestions.',
        inputEcho: body.context.slice(0, 200),
        audience: body.audience ?? 'teacher',
      };
    }

    const chat = await this.fetchAi<{ answer?: string; sources?: unknown[] }>('/api/ai/chat', {
      method: 'POST',
      body: JSON.stringify({
        student_id: viewer.id,
        message: body.context,
        grade_level: 9,
      }),
    });

    return {
      source: 'ai-service',
      suggestion: chat.answer || 'No suggestion returned from AI service.',
      inputEcho: body.context.slice(0, 200),
      audience: body.audience ?? 'teacher',
      sources: chat.sources || [],
    };
  }

  async evaluateMe(studentId: string, viewer: User) {
    await this.assertCanAccessStudent(viewer, studentId);
    const u = await this.userRepo.findOne({ where: { id: studentId } });
    if (!u || u.role !== UserRole.STUDENT) throw new NotFoundException('Student not found');

    const marks = await this.markRepo.find({ where: { studentId } });
    let presentLike = 0;
    let totalMarks = 0;
    for (const m of marks) {
      totalMarks += 1;
      if (m.status === 'present' || m.status === 'late') presentLike += 1;
    }
    const attendanceRate = totalMarks > 0 ? presentLike / totalMarks : null;

    const attempts = await this.attRepo.find({ where: { studentId }, order: { releasedAt: 'DESC' } });
    const released = attempts.filter((a) => a.releasedAt != null && a.score != null);
    const scores = released.map((a) => a.score!);
    const avgScore =
      scores.length > 0 ? Math.round((scores.reduce((x, y) => x + y, 0) / scores.length) * 100) / 100 : null;

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
      const latestTitle = lastExam?.title ?? 'Exam';
      academicSummary = `Average score across ${released.length} released exam(s): ${avgScore}. Latest: ${latestTitle}.`;
    }

    const strengths: string[] = [];
    const improvements: string[] = [];
    if (attendanceRate != null && attendanceRate >= 0.9) strengths.push('Strong attendance consistency.');
    else if (attendanceRate != null && attendanceRate >= 0.75) strengths.push('Decent attendance — keep it up!');
    else if (attendanceRate != null) improvements.push('Focus on attending every scheduled class.');
    if (avgScore != null && avgScore >= 80) strengths.push('Solid performance on released assessments.');
    else if (avgScore != null) improvements.push('Review feedback on past exams and ask teachers for clarification.');
    if (loginStreak >= 7) strengths.push('Great platform engagement streak.');
    if (strengths.length === 0 && totalMarks === 0 && released.length === 0) {
      strengths.push('You are getting started — complete enrollments and assessments to unlock richer insights.');
    }

    return {
      studentId,
      source: 'rules_engine',
      generatedAt: new Date().toISOString(),
      metrics: {
        attendanceSessionsRecorded: totalMarks,
        attendancePresentOrLateRate: attendanceRate != null ? Math.round(attendanceRate * 1000) / 1000 : null,
        releasedExamsCount: released.length,
        averageReleasedScore: avgScore,
        loginStreakDays: loginStreak,
      },
      attendanceRating,
      academicPerformanceSummary: academicSummary,
      strengths,
      areasForImprovement: improvements,
      disclaimer: 'This is an automated summary from your TriLink data, not a substitute for teacher feedback.',
    };
  }
}
