import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ParentStudent } from '../parent-students/entities/parent-student.entity';
import { User, UserRole } from '../users/entities/user.entity';
import { AttendanceMark } from '../attendance/entities/attendance-mark.entity';
import { ExamAttempt } from '../exams/entities/exam-attempt.entity';
import { Exam } from '../exams/entities/exam.entity';
import { LoginStreak } from '../gamification/entities/login-streak.entity';

/** Mock payloads until an external Python / ML service is integrated. */
@Injectable()
export class AiService {
  constructor(
    @InjectRepository(ParentStudent) private readonly psRepo: Repository<ParentStudent>,
    @InjectRepository(User) private readonly userRepo: Repository<User>,
    @InjectRepository(AttendanceMark) private readonly markRepo: Repository<AttendanceMark>,
    @InjectRepository(ExamAttempt) private readonly attRepo: Repository<ExamAttempt>,
    @InjectRepository(Exam) private readonly examRepo: Repository<Exam>,
    @InjectRepository(LoginStreak) private readonly streakRepo: Repository<LoginStreak>,
  ) {}

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
    return {
      status: 'stub',
      integration: 'pending',
      message: 'Replace with calls to the TriLink AI service when deployed.',
    };
  }

  async recommendations(studentId: string, viewer: User) {
    await this.assertCanAccessStudent(viewer, studentId);
    const u = await this.userRepo.findOne({ where: { id: studentId } });
    return {
      studentId,
      source: 'stub',
      items: [
        {
          type: 'resource',
          title: 'Sample video: Algebra fundamentals',
          reason: 'Placeholder — ML will infer from weak topics.',
          url: 'https://example.org/learn/algebra-intro',
        },
        {
          type: 'practice',
          title: 'Extra problem set (quadratics)',
          reason: 'Placeholder — based on recent exam performance.',
          estimatedMinutes: 25,
        },
      ],
      generatedAt: new Date().toISOString(),
      displayName: u ? `${u.firstName} ${u.lastName}` : null,
    };
  }

  async learningPath(studentId: string, viewer: User) {
    await this.assertCanAccessStudent(viewer, studentId);
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

  feedbackAssistant(body: { context: string; audience?: string }) {
    return {
      source: 'stub',
      suggestion:
        'This is example AI copy. Wire POST body to your Python service; return structured tone checks and bullet suggestions.',
      inputEcho: body.context.slice(0, 200),
      audience: body.audience ?? 'teacher',
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
    if (attendanceRate != null && attendanceRate >= 0.85) strengths.push('Strong attendance consistency.');
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
