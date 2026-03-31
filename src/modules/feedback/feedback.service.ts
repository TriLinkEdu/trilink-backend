import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Feedback } from './entities/feedback.entity';

@Injectable()
export class FeedbackService {
  constructor(@InjectRepository(Feedback) private readonly repo: Repository<Feedback>) {}

  create(body: Pick<Feedback, 'authorId' | 'category' | 'message'>) {
    return this.repo.save(this.repo.create({ ...body, status: 'open' }));
  }

  list() {
    return this.repo.find({ order: { createdAt: 'DESC' } });
  }

  async update(id: string, body: Partial<Pick<Feedback, 'status' | 'assigneeId'>>) {
    const f = await this.repo.findOne({ where: { id } });
    if (!f) throw new NotFoundException('Not found');
    Object.assign(f, body);
    return this.repo.save(f);
  }
}
