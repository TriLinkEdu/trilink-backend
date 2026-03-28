import { ForbiddenException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ParentStudent } from '../parent-students/entities/parent-student.entity';
import { User, UserRole } from '../users/entities/user.entity';

/** Mock payloads until an external Python / ML service is integrated. */
@Injectable()
export class AiService {
  constructor(
    @InjectRepository(ParentStudent) private readonly psRepo: Repository<ParentStudent>,
    @InjectRepository(User) private readonly userRepo: Repository<User>,
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
}
