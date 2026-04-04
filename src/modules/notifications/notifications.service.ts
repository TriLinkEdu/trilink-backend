import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Repository } from 'typeorm';
import { Notification } from './entities/notification.entity';
import { EventsGateway } from '../realtime/events.gateway';

@Injectable()
export class NotificationsService {
  constructor(
    @InjectRepository(Notification) private readonly repo: Repository<Notification>,
    private readonly events: EventsGateway,
  ) {}

  async createForUser(userId: string, body: Pick<Notification, 'type' | 'title' | 'body'> & { payloadJson?: string }) {
    const n = await this.repo.save(this.repo.create({ ...body, userId, payloadJson: body.payloadJson ?? null }));
    this.events.emitToUser(userId, 'notification:new', n);
    return n;
  }

  listForUser(userId: string, unreadOnly?: boolean) {
    const qb = this.repo.createQueryBuilder('n').where('n.user_id = :uid', { uid: userId }).orderBy('n.created_at', 'DESC');
    if (unreadOnly) qb.andWhere('n.read_at IS NULL');
    return qb.getMany();
  }

  async markRead(id: string, userId: string) {
    const n = await this.repo.findOne({ where: { id, userId } });
    if (!n) throw new NotFoundException('Notification not found');
    n.readAt = new Date();
    return this.repo.save(n);
  }

  async markAllRead(userId: string) {
    await this.repo.update({ userId, readAt: IsNull() }, { readAt: new Date() });
    return { ok: true };
  }
}
