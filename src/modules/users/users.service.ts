import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { User, UserRole } from './entities/user.entity';
import { RegisterByAdminDto } from './dto/register-by-admin.dto';
import { ParentStudentsService } from '../parent-students/parent-students.service';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    private readonly parentStudents: ParentStudentsService,
  ) {}

  async findByEmail(email: string): Promise<User | null> {
    return this.userRepo.findOne({ where: { email: email.toLowerCase() } });
  }

  async findByPhone(phone: string): Promise<User | null> {
    if (!phone) return null;
    return this.userRepo.findOne({ where: { phone } });
  }

  async findById(id: string): Promise<User | null> {
    return this.userRepo.findOne({ where: { id } });
  }

  async createAdmin(email: string, password: string, firstName: string, lastName: string): Promise<User> {
    const existing = await this.findByEmail(email);
    if (existing) throw new ConflictException('Admin with this email already exists');
    const passwordHash = await bcrypt.hash(password, 10);
    const user = this.userRepo.create({
      email: email.toLowerCase(),
      passwordHash,
      role: UserRole.ADMIN,
      firstName,
      lastName,
      mustChangePassword: false,
    });
    return this.userRepo.save(user);
  }

  async registerByAdmin(dto: RegisterByAdminDto): Promise<User> {
    const role = dto.type as unknown as UserRole;
    const email = dto.email.toLowerCase();
    const existing = await this.findByEmail(email);
    if (existing) throw new ConflictException('User with this email already exists');

    const phoneExisting = await this.findByPhone(dto.phone);
    if (phoneExisting) throw new ConflictException('This phone number is already registered');

    const tempPassword = dto.tempPassword || this.generateTempPassword();
    const passwordHash = await bcrypt.hash(tempPassword, 10);

    const user = this.userRepo.create({
      email,
      passwordHash,
      role,
      firstName: dto.firstName,
      lastName: dto.lastName,
      phone: dto.phone,
      mustChangePassword: true,
    });

    if (role === UserRole.STUDENT) {
      user.grade = dto.grade ?? null;
      user.section = dto.section ?? null;
    } else if (role === UserRole.TEACHER) {
      user.subject = dto.subject ?? null;
      user.department = dto.department ?? null;
    } else if (role === UserRole.PARENT) {
      user.childName = dto.childName ?? null;
      user.relationship = dto.relationship ?? null;
    }

    const saved = await this.userRepo.save(user);

    if (role === UserRole.PARENT && dto.linkedStudentId) {
      await this.parentStudents.create({
        parentId: saved.id,
        studentId: dto.linkedStudentId,
        relationship: dto.relationship!,
        isPrimary: dto.isPrimaryLink ?? false,
      });
    }

    (saved as any).tempPassword = tempPassword;
    return saved;
  }

  /** Remove user and parent–student rows where this user is the parent (registration rollback). */
  async rollbackRegistration(userId: string): Promise<void> {
    await this.parentStudents.deleteAllByParentId(userId);
    await this.userRepo.delete(userId);
  }

  private generateTempPassword(): string {
    const part = () => Math.random().toString(36).slice(-4).toUpperCase();
    return part() + part() + Math.random().toString(36).slice(-2);
  }

  async validatePassword(user: User, plainPassword: string): Promise<boolean> {
    return bcrypt.compare(plainPassword, user.passwordHash);
  }

  toPublic(u: User) {
    const { passwordHash: _p, ...rest } = u;
    return rest;
  }

  async listUsers(filters: { role?: UserRole; q?: string }): Promise<Partial<User>[]> {
    const qb = this.userRepo.createQueryBuilder('u').orderBy('u.createdAt', 'DESC');
    if (filters.role) qb.andWhere('u.role = :role', { role: filters.role });
    if (filters.q) {
      const s = `%${filters.q}%`;
      qb.andWhere('(u.email LIKE :s OR u.first_name LIKE :s OR u.last_name LIKE :s)', { s });
    }
    const rows = await qb.getMany();
    return rows.map((u) => this.toPublic(u) as User);
  }

  async changePassword(userId: string, currentPassword: string, newPassword: string) {
    if (currentPassword === newPassword) {
      throw new BadRequestException('New password must be different from the current password');
    }
    const u = await this.findById(userId);
    if (!u) throw new NotFoundException('User not found');
    const valid = await this.validatePassword(u, currentPassword);
    if (!valid) throw new UnauthorizedException('Current password is incorrect');
    u.passwordHash = await bcrypt.hash(newPassword, 10);
    u.mustChangePassword = false;
    await this.userRepo.save(u);
    return { ok: true as const };
  }

  async patchUser(
    id: string,
    body: Partial<
      Pick<
        User,
        | 'firstName'
        | 'lastName'
        | 'phone'
        | 'profileImageFileId'
        | 'grade'
        | 'section'
        | 'subject'
        | 'department'
        | 'childName'
        | 'relationship'
      >
    >,
  ) {
    const u = await this.findById(id);
    if (!u) throw new NotFoundException('User not found');

    const keys = [
      'firstName',
      'lastName',
      'phone',
      'profileImageFileId',
      'grade',
      'section',
      'subject',
      'department',
      'childName',
      'relationship',
    ] as const satisfies readonly (keyof User)[];

    for (const key of keys) {
      const v = body[key];
      if (v !== undefined && v !== null) {
        (u as Record<(typeof keys)[number], unknown>)[key] = v;
      }
    }

    const saved = await this.userRepo.save(u);
    return this.toPublic(saved) as User;
  }
}
