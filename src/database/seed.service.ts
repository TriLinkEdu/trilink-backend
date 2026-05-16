import { Injectable, OnModuleInit, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { User, UserRole } from '../modules/users/entities/user.entity';

@Injectable()
export class SeedService implements OnModuleInit {
  private readonly logger = new Logger(SeedService.name);

  constructor(
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
  ) {}

  async onModuleInit(): Promise<void> {
    const email = (process.env.SEED_ADMIN_EMAIL || 'admin@trilink.edu').toLowerCase();
    const password = process.env.SEED_ADMIN_PASSWORD || 'Admin@123';
    const firstName = 'System';
    const lastName = 'Admin';

    try {
      const existing = await this.userRepo.findOne({ where: { email } });
      if (existing) {
        this.logger.log(`Admin user already exists: ${email}`);
        return;
      }

      const passwordHash = await bcrypt.hash(password, 10);
      await this.userRepo.save(
        this.userRepo.create({
          email,
          passwordHash,
          role: UserRole.ADMIN,
          firstName,
          lastName,
          mustChangePassword: false,
        }),
      );
      this.logger.log(`Admin user created: ${email}`);
    } catch (err) {
      this.logger.warn(`Admin seed failed (tables may not exist yet): ${(err as Error).message}`);
    }
  }
}
