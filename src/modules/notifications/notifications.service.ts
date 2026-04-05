import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Repository } from 'typeorm';
import { Notification } from './entities/notification.entity';
import { EventsGateway } from '../realtime/events.gateway';
import { User, UserRole } from '../users/entities/user.entity';
import { ClassOffering } from '../class-offerings/entities/class-offering.entity';
import { Enrollment } from '../enrollments/entities/enrollment.entity';

export type BroadcastAudience = 'class' | 'all_students';

@Injectable()
export class NotificationsService {
  constructor(
    @InjectRepository(Notification) private readonly repo: Repository<Notification>,
    @InjectRepository(User) private readonly userRepo: Repository<User>,
    @InjectRepository(ClassOffering) private readonly coRepo: Repository<ClassOffering>,
    @InjectRepository(Enrollment) private readonly enrRepo: Repository<Enrollment>,
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

  async broadcastFromStaff(
    user: User,
    dto: { title: string; body: string; audience: BroadcastAudience; classOfferingId?: string },
  ) {
    if (user.role !== UserRole.TEACHER && user.role !== UserRole.ADMIN) {
      throw new ForbiddenException('Only teachers and admins can broadcast');
    }

    if (dto.audience === 'all_students') {
      if (user.role !== UserRole.ADMIN) {
        throw new ForbiddenException('Only admins can notify all students');
      }
      const students = await this.userRepo.find({ where: { role: UserRole.STUDENT } });
      await Promise.all(
        students.map((s) =>
          this.createForUser(s.id, {
            type: 'broadcast',
            title: dto.title,
            body: dto.body,
            payloadJson: JSON.stringify({ audience: 'all_students' }),
          }),
        ),
      );
      return { audience: 'all_students', sent: students.length };
    }

    if (!dto.classOfferingId) {
      throw new BadRequestException('classOfferingId is required when audience is class');
    }

    const co = await this.coRepo.findOne({ where: { id: dto.classOfferingId } });
    if (!co) throw new NotFoundException('Class offering not found');

    if (user.role === UserRole.TEACHER && co.teacherId !== user.id) {
      throw new ForbiddenException('You do not teach this class');
    }

    const enr = await this.enrRepo.find({
      where: { classOfferingId: dto.classOfferingId, status: 'active' },
    });
    await Promise.all(
      enr.map((e) =>
        this.createForUser(e.studentId, {
          type: 'broadcast',
          title: dto.title,
          body: dto.body,
          payloadJson: JSON.stringify({ classOfferingId: dto.classOfferingId }),
        }),
      ),
    );
    return { audience: 'class', classOfferingId: dto.classOfferingId, sent: enr.length };
  }
}
