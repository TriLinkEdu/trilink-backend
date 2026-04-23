import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Feedback, FeedbackType, FeedbackSenderRole } from './entities/feedback.entity';
import { UserRole } from '../users/entities/user.entity';

function sanitizeForViewer(row: Feedback): Omit<Feedback, 'authorId'> & { authorId: string | null } {
  const { authorId, ...rest } = row;
  if (row.isAnonymous) {
    return { ...rest, authorId: null };
  }
  return { ...rest, authorId };
}

function mapUserRoleToSenderRole(role: UserRole): FeedbackSenderRole | null {
  switch (role) {
    case UserRole.STUDENT:
      return FeedbackSenderRole.STUDENT;
    case UserRole.PARENT:
      return FeedbackSenderRole.PARENT;
    case UserRole.TEACHER:
      return FeedbackSenderRole.TEACHER;
    default:
      return null;
  }
}

@Injectable()
export class FeedbackService {
  constructor(@InjectRepository(Feedback) private readonly repo: Repository<Feedback>) {}

  create(body: {
    authorId: string | null;
    authorRole: UserRole;
    category: FeedbackType;
    message: string;
    subjectId?: string | null;
    teacherId?: string | null;
    isAnonymous?: boolean;
  }) {
    const isAnonymous = body.isAnonymous !== false;
    const senderRole = mapUserRoleToSenderRole(body.authorRole);
    return this.repo.save(
      this.repo.create({
        authorId: isAnonymous ? null : body.authorId,
        senderRole,
        category: body.category,
        message: body.message,
        subjectId: body.subjectId ?? null,
        teacherId: body.teacherId ?? null,
        isAnonymous,
        status: 'open',
      }),
    );
  }

  /**
   * Admin: list all feedback with optional filters.
   * Returns sanitized (authorId hidden when anonymous).
   */
  async list(filters?: { subjectId?: string; teacherId?: string; senderRole?: FeedbackSenderRole; category?: FeedbackType }) {
    const qb = this.repo.createQueryBuilder('f').orderBy('f.created_at', 'DESC');
    if (filters?.subjectId) qb.andWhere('f.subject_id = :sid', { sid: filters.subjectId });
    if (filters?.teacherId) qb.andWhere('f.teacher_id = :tid', { tid: filters.teacherId });
    if (filters?.senderRole) qb.andWhere('f.sender_role = :sr', { sr: filters.senderRole });
    if (filters?.category) qb.andWhere('f.category = :cat', { cat: filters.category });
    const rows = await qb.getMany();
    return rows.map((r) => sanitizeForViewer(r));
  }

  /**
   * Teacher: list feedback directed at them (category = 'teacher' and teacherId = their ID).
   */
  async listForTeacher(teacherId: string) {
    const rows = await this.repo.find({
      where: { teacherId, category: FeedbackType.TEACHER },
      order: { createdAt: 'DESC' },
    });
    return rows.map((r) => sanitizeForViewer(r));
  }

  /**
   * Sender: list feedback they submitted (non-anonymous only, since anonymous has no authorId).
   */
  async listMine(authorId: string) {
    const rows = await this.repo.find({
      where: { authorId },
      order: { createdAt: 'DESC' },
    });
    return rows;
  }

  async update(id: string, body: Partial<Pick<Feedback, 'status' | 'assigneeId'>>) {
    const f = await this.repo.findOne({ where: { id } });
    if (!f) throw new NotFoundException('Not found');
    Object.assign(f, body);
    const saved = await this.repo.save(f);
    return sanitizeForViewer(saved);
  }
}
