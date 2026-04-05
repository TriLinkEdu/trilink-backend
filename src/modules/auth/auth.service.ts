import { Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { UsersService } from '../users/users.service';
import { User, UserRole } from '../users/entities/user.entity';
import { LoginDto } from './dto/login.dto';
import { AuditService } from '../audit/audit.service';
import { GamificationService } from '../gamification/gamification.service';

export interface JwtPayload {
  sub: string;
  email: string;
  role: UserRole;
  type: 'access' | 'refresh';
}

export interface TokenResponse {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  user: {
    id: string;
    email: string;
    role: string;
    firstName: string;
    lastName: string;
    mustChangePassword: boolean;
    profileImageFileId: string | null;
  };
}

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
    private readonly config: ConfigService,
    private readonly audit: AuditService,
    private readonly gamification: GamificationService,
  ) {}

  async login(dto: LoginDto): Promise<TokenResponse> {
    const user = await this.usersService.findByEmail(dto.email);
    if (!user) throw new UnauthorizedException('Invalid email or password');

    const roleMatch = dto.role.toLowerCase() === user.role;
    if (!roleMatch) throw new UnauthorizedException('Invalid email or password');

    const valid = await this.usersService.validatePassword(user, dto.password);
    if (!valid) throw new UnauthorizedException('Invalid email or password');

    const res = this.buildTokenResponse(user);
    void this.safeAudit(
      user.id,
      'user.login',
      'session',
      user.id,
      JSON.stringify({ accountRole: user.role, portalRole: dto.role }),
    );
    void this.gamification.recordLogin(user.id).catch(() => undefined);
    return res;
  }

  private async safeAudit(actorId: string, action: string, entityType: string, entityId: string, diffJson?: string) {
    try {
      await this.audit.log(actorId, action, entityType, entityId, diffJson);
    } catch (e) {
      this.logger.warn(`Audit log skipped (${action})`, e instanceof Error ? e.message : e);
    }
  }

  async refresh(refreshToken: string): Promise<TokenResponse> {
    try {
      const payload = this.jwtService.verify<JwtPayload>(refreshToken, {
        secret: this.config.get<string>('jwt.secret'),
      });
      if (payload.type !== 'refresh') throw new UnauthorizedException('Invalid token');
      const user = await this.usersService.findById(payload.sub);
      if (!user) throw new UnauthorizedException('User not found');
      return this.buildTokenResponse(user);
    } catch {
      throw new UnauthorizedException('Invalid or expired refresh token');
    }
  }

  async validateUser(payload: JwtPayload): Promise<User | null> {
    if (payload.type !== 'access') return null;
    return this.usersService.findById(payload.sub);
  }

  private buildTokenResponse(user: User): TokenResponse {
    const payloadBase = { sub: user.id, email: user.email, role: user.role };
    const accessToken = this.jwtService.sign(
      { ...payloadBase, type: 'access' },
      { expiresIn: this.config.get<string>('jwt.accessExpires') },
    );
    const refreshToken = this.jwtService.sign(
      { ...payloadBase, type: 'refresh' },
      { expiresIn: this.config.get<string>('jwt.refreshExpires') },
    );
    const expiresIn = 900; // 15 min in seconds; could parse from accessExpires
    return {
      accessToken,
      refreshToken,
      expiresIn,
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
        firstName: user.firstName,
        lastName: user.lastName,
        mustChangePassword: user.mustChangePassword,
        profileImageFileId: user.profileImageFileId ?? null,
      },
    };
  }
}
