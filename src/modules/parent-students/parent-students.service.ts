import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { ParentStudent } from './entities/parent-student.entity';
import { User, UserRole } from '../users/entities/user.entity';

@Injectable()
export class ParentStudentsService {
  constructor(
    @InjectRepository(ParentStudent) private readonly repo: Repository<ParentStudent>,
    @InjectRepository(User) private readonly userRepo: Repository<User>,
  ) {}

  async list(q: { parentId?: string; studentId?: string }) {
    const where: Record<string, string> = {};
    if (q.parentId) where.parentId = q.parentId;
    if (q.studentId) where.studentId = q.studentId;
    return this.repo.find({ where: Object.keys(where).length ? where : {} });
  }

  async myChildren(parentId: string) {
    const links = await this.repo.find({ where: { parentId } });
    const studentIds = links.map(l => l.studentId);
    if (!studentIds.length) return [];
    const students = await this.userRepo.findBy({
      id: In(studentIds),
    });
    // Only return non-sensitive fields
    return links.map(link => {
      const student = students.find(s => s.id === link.studentId);
      return {
        ...link,
        student: student
          ? {
              id: student.id,
              firstName: student.firstName,
              lastName: student.lastName,
              email: student.email,
              // Add more non-sensitive fields as needed
            }
          : null,
      };
    });
  }

  async create(body: { parentId: string; studentId: string; relationship: string; isPrimary?: boolean }) {
    const p = await this.userRepo.findOne({ where: { id: body.parentId } });
    const s = await this.userRepo.findOne({ where: { id: body.studentId } });
    if (!p || p.role !== UserRole.PARENT) throw new BadRequestException('parentId must be parent');
    if (!s || s.role !== UserRole.STUDENT) throw new BadRequestException('studentId must be student');
    const dup = await this.repo.findOne({ where: { parentId: body.parentId, studentId: body.studentId } });
    if (dup) throw new ConflictException('Link exists');
    return this.repo.save(this.repo.create({ ...body, isPrimary: body.isPrimary ?? false }));
  }

  async remove(id: string) {
    const r = await this.repo.findOne({ where: { id } });
    if (!r) throw new NotFoundException('Link not found');
    await this.repo.remove(r);
  }

  async deleteAllByParentId(parentId: string) {
    await this.repo.delete({ parentId });
  }
}
