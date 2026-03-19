import { Injectable, ConflictException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { User, UserRole } from './entities/user.entity';
import { RegisterByAdminDto } from './dto/register-by-admin.dto';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
  ) {}

  async findByEmail(email: string): Promise<User | null> {
    return this.userRepo.findOne({ where: { email: email.toLowerCase() } });
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

    const tempPassword = dto.tempPassword || this.generateTempPassword();
    const passwordHash = await bcrypt.hash(tempPassword, 10);

    const user = this.userRepo.create({
      email,
      passwordHash,
      role,
      firstName: dto.firstName,
      lastName: dto.lastName,
      phone: dto.phone ?? null,
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
    (saved as any).tempPassword = tempPassword;
    return saved;
  }

  private generateTempPassword(): string {
    const part = () => Math.random().toString(36).slice(-4).toUpperCase();
    return part() + part() + Math.random().toString(36).slice(-2);
  }

  async validatePassword(user: User, plainPassword: string): Promise<boolean> {
    return bcrypt.compare(plainPassword, user.passwordHash);
  }
}
