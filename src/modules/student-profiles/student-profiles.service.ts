import { ForbiddenException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { StudentProfile } from './entities/student-profile.entity';
import { User, UserRole } from '../users/entities/user.entity';
import { ParentStudent } from '../parent-students/entities/parent-student.entity';

@Injectable()
export class StudentProfilesService {
  constructor(
    @InjectRepository(StudentProfile) private readonly repo: Repository<StudentProfile>,
    @InjectRepository(User) private readonly userRepo: Repository<User>,
    @InjectRepository(ParentStudent) private readonly psRepo: Repository<ParentStudent>,
  ) {}

  private async assertStudent(userId: string) {
    const u = await this.userRepo.findOne({ where: { id: userId } });
    if (!u || u.role !== UserRole.STUDENT) throw new ForbiddenException('Profile is for students only');
  }

  async assertViewer(viewer: User, studentUserId: string) {
    if (viewer.role === UserRole.ADMIN || viewer.role === UserRole.TEACHER) return;
    if (viewer.role === UserRole.STUDENT && viewer.id === studentUserId) return;
    if (viewer.role === UserRole.PARENT) {
      const link = await this.psRepo.findOne({ where: { parentId: viewer.id, studentId: studentUserId } });
      if (link) return;
    }
    throw new ForbiddenException('Cannot view this profile');
  }

  async getOrCreate(studentUserId: string) {
    await this.assertStudent(studentUserId);
    let p = await this.repo.findOne({ where: { userId: studentUserId } });
    if (!p) p = await this.repo.save(this.repo.create({ userId: studentUserId }));
    return p;
  }

  async getForViewer(studentUserId: string, viewer: User) {
    await this.assertViewer(viewer, studentUserId);
    return this.getOrCreate(studentUserId);
  }

  async patchMe(studentUserId: string, viewer: User, body: Partial<Pick<StudentProfile, 'bio' | 'avatarFileId' | 'extraJson'>>) {
    if (viewer.role !== UserRole.STUDENT || viewer.id !== studentUserId) {
      throw new ForbiddenException('Only the student can edit their profile');
    }
    await this.assertStudent(studentUserId);
    let p = await this.repo.findOne({ where: { userId: studentUserId } });
    if (!p) p = this.repo.create({ userId: studentUserId });
    if (body.bio !== undefined) p.bio = body.bio;
    if (body.avatarFileId !== undefined) p.avatarFileId = body.avatarFileId;
    if (body.extraJson !== undefined) p.extraJson = body.extraJson;
    return this.repo.save(p);
  }
}
