import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Announcement } from './entities/announcement.entity';
import { User, UserRole } from '../users/entities/user.entity';
import { Enrollment } from '../enrollments/entities/enrollment.entity';

@Injectable()
export class AnnouncementsService {
  constructor(
    @InjectRepository(Announcement) private readonly repo: Repository<Announcement>,
    @InjectRepository(Enrollment) private readonly enrRepo: Repository<Enrollment>,
  ) {}

  create(body: Partial<Announcement> & Pick<Announcement, 'academicYearId' | 'title' | 'body' | 'audience' | 'authorId'>) {
    return this.repo.save(this.repo.create(body));
  }

  list(yearId?: string) {
    return yearId
      ? this.repo.find({ where: { academicYearId: yearId }, order: { createdAt: 'DESC' } })
      : this.repo.find({ order: { createdAt: 'DESC' } });
  }

  async forUser(user: User) {
    const all = await this.repo.find({ order: { createdAt: 'DESC' } });
    if (user.role === UserRole.ADMIN || user.role === UserRole.TEACHER) return all;
    if (user.role === UserRole.STUDENT) {
      const enr = await this.enrRepo.find({ where: { studentId: user.id, status: 'active' } });
      const classIds = enr.map((e) => e.classOfferingId);
      return all.filter(
        (a) =>
          a.audience === 'all' ||
          a.audience === 'students' ||
          (a.audience === 'class' && a.classOfferingId && classIds.includes(a.classOfferingId)),
      );
    }
    if (user.role === UserRole.PARENT) {
      return all.filter((a) => a.audience === 'all' || a.audience === 'parents');
    }
    return [];
  }

  async remove(id: string) {
    const a = await this.repo.findOne({ where: { id } });
    if (!a) throw new NotFoundException('Not found');
    await this.repo.remove(a);
  }
}
