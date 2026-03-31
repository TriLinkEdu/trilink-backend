import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CalendarEvent } from './entities/calendar-event.entity';

@Injectable()
export class CalendarService {
  constructor(@InjectRepository(CalendarEvent) private readonly repo: Repository<CalendarEvent>) {}

  async list(filters: { from?: string; to?: string; yearId?: string; classOfferingId?: string }) {
    const qb = this.repo.createQueryBuilder('e').orderBy('e.date', 'ASC');
    if (filters.yearId) qb.andWhere('e.academic_year_id = :y', { y: filters.yearId });
    if (filters.classOfferingId) qb.andWhere('e.class_offering_id = :c', { c: filters.classOfferingId });
    if (filters.from && filters.to) qb.andWhere('e.date BETWEEN :f AND :t', { f: filters.from, t: filters.to });
    return qb.getMany();
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

  async remove(id: string) {
    const e = await this.repo.findOne({ where: { id } });
    if (!e) throw new NotFoundException('Event not found');
    await this.repo.remove(e);
  }
}
