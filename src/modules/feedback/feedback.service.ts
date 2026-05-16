import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { Feedback, FeedbackType, FeedbackSenderRole } from './entities/feedback.entity';
import { User, UserRole } from '../users/entities/user.entity';
import { ParentStudent } from '../parent-students/entities/parent-student.entity';

function sanitizeForViewer(row: Feedback): Omit<Feedback, 'authorId'> & { authorId: string | null } {
  const { authorId, ...rest } = row;
  if (row.isAnonymous) {
    return { ...rest, authorId: null };
  }
  return { ...rest, authorId };
}

function mapUserRoleToSenderRole(role: UserRole): FeedbackSenderRole | null {
  switch (role) {
    case UserRole.STUDENT: return FeedbackSenderRole.STUDENT;
    case UserRole.PARENT: return FeedbackSenderRole.PARENT;
    case UserRole.TEACHER: return FeedbackSenderRole.TEACHER;
    default: return null;
  }
}

@Injectable()
export class FeedbackService {
  constructor(
    @InjectRepository(Feedback) private readonly repo: Repository<Feedback>,
    @InjectRepository(User) private readonly userRepo: Repository<User>,
    @InjectRepository(ParentStudent) private readonly psRepo: Repository<ParentStudent>,
  ) {}

  /** Enrich a feedback row with sender name and (for parents) child name. */
  private async enrichSender(row: Feedback) {
    const base = sanitizeForViewer(row);
    if (row.isAnonymous || !row.authorId) {
      return { ...base, sender: null };
    }
    const author = await this.userRepo.findOne({ where: { id: row.authorId } });
    const sender = author
      ? {
          id: author.id,
          firstName: author.firstName,
          lastName: author.lastName,
          email: author.email,
          role: author.role,
        }
      : null;

    // If sender is a parent, also include their linked children's names
    let children: Array<{ studentId: string; firstName: string; lastName: string }> | null = null;
    if (author?.role === UserRole.PARENT) {
      const links = await this.psRepo.find({ where: { parentId: author.id } });
      if (links.length) {
        const studentIds = links.map(l => l.studentId);
        const students = await this.userRepo.findBy({ id: In(studentIds) });
        children = students.map(s => ({ studentId: s.id, firstName: s.firstName, lastName: s.lastName }));
      }
    }

    return { ...base, sender, children };
  }

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
   * Teacher: list feedback directed at them, enriched with sender name and child info.
   */
  async listForTeacher(teacherId: string) {
    const rows = await this.repo.find({
      where: { teacherId, category: FeedbackType.TEACHER },
      order: { createdAt: 'DESC' },
    });
    return Promise.all(rows.map(r => this.enrichSender(r)));
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
