import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { CalendarEvent } from './entities/calendar-event.entity';
import { Enrollment } from '../enrollments/entities/enrollment.entity';
import { ParentStudent } from '../parent-students/entities/parent-student.entity';
import { User, UserRole } from '../users/entities/user.entity';

@Injectable()
export class CalendarService {
  constructor(
    @InjectRepository(CalendarEvent) private readonly repo: Repository<CalendarEvent>,
    @InjectRepository(Enrollment) private readonly enrRepo: Repository<Enrollment>,
    @InjectRepository(ParentStudent) private readonly psRepo: Repository<ParentStudent>,
  ) {}

  private baseQuery(filters: { from?: string; to?: string; yearId?: string; classOfferingId?: string; termId?: string }) {
    const qb = this.repo.createQueryBuilder('e').orderBy('e.date', 'ASC');
    if (filters.yearId) qb.andWhere('e.academic_year_id = :y', { y: filters.yearId });
    if (filters.classOfferingId) qb.andWhere('e.class_offering_id = :c', { c: filters.classOfferingId });
    if (filters.termId) qb.andWhere('(e.term_id IS NULL OR e.term_id = :tid)', { tid: filters.termId });
    if (filters.from && filters.to) qb.andWhere('e.date BETWEEN :f AND :t', { f: filters.from, t: filters.to });
    return qb;
  }

  async list(filters: { from?: string; to?: string; yearId?: string; classOfferingId?: string; termId?: string }) {
    return this.baseQuery(filters).getMany();
  }

  async listForViewer(user: User, filters: { from?: string; to?: string; yearId?: string; classOfferingId?: string; termId?: string }) {
    if (user.role === UserRole.ADMIN || user.role === UserRole.TEACHER) {
      return this.list(filters);
    }

    let allowedClassIds: string[] = [];
    if (user.role === UserRole.STUDENT) {
      const enr = await this.enrRepo.find({ where: { studentId: user.id, status: 'active' } });
      allowedClassIds = enr.map((e) => e.classOfferingId);
    } else if (user.role === UserRole.PARENT) {
      const links = await this.psRepo.find({ where: { parentId: user.id } });
      const studentIds = links.map((l) => l.studentId);
      if (studentIds.length) {
        const enr = await this.enrRepo.find({
          where: { studentId: In(studentIds), status: 'active' },
        });
        allowedClassIds = [...new Set(enr.map((e) => e.classOfferingId))];
      }
    }

    const qb = this.baseQuery(filters);
    if (allowedClassIds.length === 0) {
      qb.andWhere('e.class_offering_id IS NULL');
    } else {
      qb.andWhere('(e.class_offering_id IS NULL OR e.class_offering_id IN (:...cids))', { cids: allowedClassIds });
    }
    return qb.getMany();
  }

  async getForViewer(user: User, id: string) {
    const event = await this.repo.findOne({ where: { id } });
    if (!event) throw new NotFoundException('Event not found');

    if (user.role === UserRole.ADMIN || user.role === UserRole.TEACHER) {
      return event;
    }

    if (!event.classOfferingId) {
      return event;
    }

    let allowedClassIds: string[] = [];
    if (user.role === UserRole.STUDENT) {
      const enr = await this.enrRepo.find({
        where: { studentId: user.id, status: 'active' },
      });
      allowedClassIds = enr.map((e) => e.classOfferingId);
    } else if (user.role === UserRole.PARENT) {
      const links = await this.psRepo.find({ where: { parentId: user.id } });
      const studentIds = links.map((l) => l.studentId);
      if (studentIds.length) {
        const enr = await this.enrRepo.find({
          where: { studentId: In(studentIds), status: 'active' },
        });
        allowedClassIds = [...new Set(enr.map((e) => e.classOfferingId))];
      }
    }

    if (!allowedClassIds.includes(event.classOfferingId)) {
      throw new ForbiddenException('You do not have access to this event');
    }

    return event;
  }

  async create(body: Partial<CalendarEvent> & Pick<CalendarEvent, 'academicYearId' | 'title' | 'date' | 'type' | 'createdById'>) {
    return this.repo.save(this.repo.create(body));
  }

  async update(id: string, body: Partial<CalendarEvent>) {
    const e = await this.repo.findOne({ where: { id } });
    if (!e) throw new NotFoundException('Event not found');
    Object.assign(e, body);
    return this.repo.save(e);
  }

  async remove(id: string, viewer?: User) {
    const e = await this.repo.findOne({ where: { id } });
    if (!e) throw new NotFoundException('Event not found');
    if (viewer && viewer.role !== UserRole.ADMIN && e.createdById !== viewer.id) {
      throw new ForbiddenException('You can only delete your own events');
    }
    await this.repo.remove(e);
  }
}
