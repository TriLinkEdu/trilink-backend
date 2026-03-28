import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ClassOffering } from './entities/class-offering.entity';
import { User, UserRole } from '../users/entities/user.entity';

@Injectable()
export class ClassOfferingsService {
  constructor(
    @InjectRepository(ClassOffering) private readonly repo: Repository<ClassOffering>,
    @InjectRepository(User) private readonly userRepo: Repository<User>,
  ) {}

  async list(yearId: string) {
    return this.repo.find({ where: { academicYearId: yearId }, order: { createdAt: 'DESC' } });
  }

  async listForTeacher(teacherId: string, academicYearId: string) {
    return this.repo.find({
      where: { teacherId, academicYearId },
      order: { createdAt: 'DESC' },
    });
  }

  async one(id: string) {
    const o = await this.repo.findOne({ where: { id } });
    if (!o) throw new NotFoundException('Class offering not found');
    return o;
  }

  async create(body: {
    academicYearId: string;
    gradeId: string;
    sectionId: string;
    subjectId: string;
    teacherId: string;
    name?: string;
  }) {
    const t = await this.userRepo.findOne({ where: { id: body.teacherId } });
    if (!t || t.role !== UserRole.TEACHER) throw new BadRequestException('teacherId must be a teacher user');
    return this.repo.save(this.repo.create(body));
  }

  async update(id: string, body: Partial<Pick<ClassOffering, 'teacherId' | 'name'>>) {
    const o = await this.one(id);
    if (body.teacherId) {
      const t = await this.userRepo.findOne({ where: { id: body.teacherId } });
      if (!t || t.role !== UserRole.TEACHER) throw new BadRequestException('teacherId must be a teacher user');
      o.teacherId = body.teacherId;
    }
    if (body.name !== undefined) o.name = body.name;
    return this.repo.save(o);
  }

  async remove(id: string) {
    await this.repo.remove(await this.one(id));
  }
}
