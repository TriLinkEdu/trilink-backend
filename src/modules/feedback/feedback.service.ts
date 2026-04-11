import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Feedback, FeedbackType } from './entities/feedback.entity';

function sanitizeForViewer(row: Feedback): Omit<Feedback, 'authorId'> & { authorId: string | null } {
  const { authorId, ...rest } = row;
  if (row.isAnonymous) {
    return { ...rest, authorId: null };
  }
  return { ...rest, authorId };
}

@Injectable()
export class FeedbackService {
  constructor(@InjectRepository(Feedback) private readonly repo: Repository<Feedback>) {}

  create(body: {
    authorId: string | null;
    category: FeedbackType;
    message: string;
    subjectId?: string | null;
    teacherId?: string | null;
    isAnonymous?: boolean;
  }) {
    const isAnonymous = body.isAnonymous !== false;
    return this.repo.save(
      this.repo.create({
        authorId: isAnonymous ? null : body.authorId,
        category: body.category,
        message: body.message,
        subjectId: body.subjectId ?? null,
        teacherId: body.teacherId ?? null,
        isAnonymous,
        status: 'open',
      }),
    );
  }

  async list(filters?: { subjectId?: string; teacherId?: string }) {
    const qb = this.repo.createQueryBuilder('f').orderBy('f.created_at', 'DESC');
    if (filters?.subjectId) qb.andWhere('f.subject_id = :sid', { sid: filters.subjectId });
    if (filters?.teacherId) qb.andWhere('f.teacher_id = :tid', { tid: filters.teacherId });
    const rows = await qb.getMany();
    return rows.map((r) => sanitizeForViewer(r));
  }

  async listForTeacher(teacherId: string) {
    const rows = await this.repo.find({
      where: { teacherId },
      order: { createdAt: 'DESC' },
    });
    return rows.map((r) => sanitizeForViewer(r));
  }

  async update(id: string, body: Partial<Pick<Feedback, 'status' | 'assigneeId'>>) {
    const f = await this.repo.findOne({ where: { id } });
    if (!f) throw new NotFoundException('Not found');
    Object.assign(f, body);
    const saved = await this.repo.save(f);
    return sanitizeForViewer(saved);
  }
}
