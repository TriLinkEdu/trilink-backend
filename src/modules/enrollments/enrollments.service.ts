import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Enrollment } from './entities/enrollment.entity';
import { User, UserRole } from '../users/entities/user.entity';
import { ClassOffering } from '../class-offerings/entities/class-offering.entity';

@Injectable()
export class EnrollmentsService {
  constructor(
    @InjectRepository(Enrollment) private readonly repo: Repository<Enrollment>,
    @InjectRepository(User) private readonly userRepo: Repository<User>,
    @InjectRepository(ClassOffering) private readonly classRepo: Repository<ClassOffering>,
  ) {}

  async list(q: { studentId?: string; classOfferingId?: string; academicYearId?: string }) {
    const where: Record<string, string> = {};
    if (q.studentId) where.studentId = q.studentId;
    if (q.classOfferingId) where.classOfferingId = q.classOfferingId;
    if (q.academicYearId) where.academicYearId = q.academicYearId;
    return this.repo.find({
      where: Object.keys(where).length ? where : {},
      order: { createdAt: 'DESC' },
    });
  }

  async create(body: { studentId: string; classOfferingId: string; academicYearId: string }) {
    const u = await this.userRepo.findOne({ where: { id: body.studentId } });
    if (!u || u.role !== UserRole.STUDENT) throw new BadRequestException('studentId must be a student');
    const c = await this.classRepo.findOne({ where: { id: body.classOfferingId } });
    if (!c) throw new NotFoundException('Class offering not found');
    if (c.academicYearId !== body.academicYearId) throw new BadRequestException('academicYearId mismatch with class offering');
    const dup = await this.repo.findOne({ where: { studentId: body.studentId, classOfferingId: body.classOfferingId } });
    if (dup) throw new ConflictException('Already enrolled');
    return this.repo.save(this.repo.create({ ...body, status: 'active' }));
  }

  async remove(id: string) {
    const e = await this.repo.findOne({ where: { id } });
    if (!e) throw new NotFoundException('Enrollment not found');
    await this.repo.remove(e);
  }
}
