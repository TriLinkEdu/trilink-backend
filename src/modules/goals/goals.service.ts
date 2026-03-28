import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { StudentGoal } from './entities/student-goal.entity';
import { User, UserRole } from '../users/entities/user.entity';
import { ParentStudent } from '../parent-students/entities/parent-student.entity';

@Injectable()
export class GoalsService {
  constructor(
    @InjectRepository(StudentGoal) private readonly repo: Repository<StudentGoal>,
    @InjectRepository(User) private readonly userRepo: Repository<User>,
    @InjectRepository(ParentStudent) private readonly psRepo: Repository<ParentStudent>,
  ) {}

  private async assertStudentRole(studentId: string) {
    const u = await this.userRepo.findOne({ where: { id: studentId } });
    if (!u || u.role !== UserRole.STUDENT) throw new NotFoundException('Student not found');
  }

  async assertViewerForStudent(viewer: User, studentId: string) {
    if (viewer.role === UserRole.ADMIN || viewer.role === UserRole.TEACHER) return;
    if (viewer.role === UserRole.STUDENT && viewer.id === studentId) return;
    if (viewer.role === UserRole.PARENT) {
      const link = await this.psRepo.findOne({ where: { parentId: viewer.id, studentId } });
      if (link) return;
    }
    throw new ForbiddenException('Cannot access goals for this student');
  }

  async listForStudent(studentId: string, viewer: User) {
    await this.assertViewerForStudent(viewer, studentId);
    return this.repo.find({ where: { studentId }, order: { createdAt: 'DESC' } });
  }

  async create(studentId: string, viewer: User, body: Partial<StudentGoal>) {
    if (viewer.role !== UserRole.STUDENT || viewer.id !== studentId) {
      throw new ForbiddenException('Students can only create goals for themselves');
    }
    await this.assertStudentRole(studentId);
    return this.repo.save(
      this.repo.create({
        studentId,
        title: body.title!,
        description: body.description ?? null,
        targetDate: body.targetDate ?? null,
        status: body.status ?? 'active',
        progressPercent: body.progressPercent ?? 0,
      }),
    );
  }

  async patch(goalId: string, viewer: User, body: Partial<Pick<StudentGoal, 'title' | 'description' | 'targetDate' | 'status' | 'progressPercent'>>) {
    const g = await this.repo.findOne({ where: { id: goalId } });
    if (!g) throw new NotFoundException('Goal not found');
    if (viewer.role !== UserRole.STUDENT || viewer.id !== g.studentId) {
      throw new ForbiddenException('Only the student owner can edit this goal');
    }
    Object.assign(g, body);
    return this.repo.save(g);
  }

  async remove(goalId: string, viewer: User) {
    const g = await this.repo.findOne({ where: { id: goalId } });
    if (!g) throw new NotFoundException('Goal not found');
    if (viewer.role !== UserRole.STUDENT || viewer.id !== g.studentId) {
      throw new ForbiddenException('Only the student owner can delete');
    }
    await this.repo.remove(g);
    return { ok: true };
  }
}
