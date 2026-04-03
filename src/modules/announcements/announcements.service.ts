import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Cron, CronExpression } from '@nestjs/schedule';
import { Announcement } from './entities/announcement.entity';
import { User, UserRole } from '../users/entities/user.entity';
import { Enrollment } from '../enrollments/entities/enrollment.entity';
import { EventsGateway } from '../realtime/events.gateway';

@Injectable()
export class AnnouncementsService {
  constructor(
    @InjectRepository(Announcement) private readonly repo: Repository<Announcement>,
    @InjectRepository(Enrollment) private readonly enrRepo: Repository<Enrollment>,
    private readonly events: EventsGateway,
  ) {}

  private shouldEmitNow(publishAt: Date | null): boolean {
    if (!publishAt) return true;
    return publishAt.getTime() <= Date.now();
  }

  async create(
    body: Partial<Announcement> & Pick<Announcement, 'academicYearId' | 'title' | 'body' | 'audience' | 'authorId'>,
  ) {
    const publishAt = body.publishAt ?? null;
    const a = await this.repo.save(
      this.repo.create({
        ...body,
        publishAt,
        realtimeSent: false,
      }),
    );
    if (this.shouldEmitNow(publishAt)) {
      this.events.emitToAll('announcement:new', a);
      a.realtimeSent = true;
      await this.repo.save(a);
    }
    return a;
  }

  @Cron(CronExpression.EVERY_MINUTE)
  async flushScheduledAnnouncements() {
    const now = new Date();
    const due = await this.repo
      .createQueryBuilder('a')
      .where('a.realtime_sent = :rs', { rs: false })
      .andWhere('a.publish_at IS NOT NULL')
      .andWhere('a.publish_at <= :now', { now })
      .getMany();
    for (const a of due) {
      if (!a.publishAt) continue;
      this.events.emitToAll('announcement:new', a);
      a.realtimeSent = true;
      await this.repo.save(a);
    }
  }

  list(yearId?: string) {
    const qb = this.repo.createQueryBuilder('a').orderBy('a.created_at', 'DESC');
    if (yearId) qb.where('a.academic_year_id = :y', { y: yearId });
    return qb.getMany();
  }

  private isVisibleToAudience(a: Announcement, now: Date): boolean {
    if (!a.publishAt) return true;
    return a.publishAt.getTime() <= now.getTime();
  }

  async forUser(user: User) {
    const now = new Date();
    const all = await this.repo.find({ order: { createdAt: 'DESC' } });
    const visible = all.filter((a) => this.isVisibleToAudience(a, now));
    if (user.role === UserRole.ADMIN || user.role === UserRole.TEACHER) return visible;
    if (user.role === UserRole.STUDENT) {
      const enr = await this.enrRepo.find({ where: { studentId: user.id, status: 'active' } });
      const classIds = enr.map((e) => e.classOfferingId);
      return visible.filter(
        (a) =>
          a.audience === 'all' ||
          a.audience === 'students' ||
          (a.audience === 'class' && a.classOfferingId && classIds.includes(a.classOfferingId)),
      );
    }
    if (user.role === UserRole.PARENT) {
      return visible.filter((a) => a.audience === 'all' || a.audience === 'parents');
    }
    return [];
  }

  async update(
    id: string,
    body: Partial<Pick<Announcement, 'title' | 'body' | 'audience' | 'classOfferingId' | 'publishAt'>>,
    viewer: User,
  ) {
    const a = await this.repo.findOne({ where: { id } });
    if (!a) throw new NotFoundException('Not found');
    if (viewer.role !== UserRole.ADMIN && a.authorId !== viewer.id) {
      throw new ForbiddenException('Only the author or admin can edit');
    }
    Object.assign(a, body);
    return this.repo.save(a);
  }

  async remove(id: string) {
    const a = await this.repo.findOne({ where: { id } });
    if (!a) throw new NotFoundException('Not found');
    await this.repo.remove(a);
  }
}
