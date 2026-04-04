import { Body, Controller, Get, Logger, Post, ServiceUnavailableException, UseGuards } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiBody,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { AuthService, TokenResponse } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { LoginResponseDto } from './dto/login-response.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import { RegisterResponseDto } from './dto/register-response.dto';
import { RegisterByAdminDto } from '../users/dto/register-by-admin.dto';
import { UsersService } from '../users/users.service';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { RolesGuard } from './guards/roles.guard';
import { Roles } from './decorators/roles.decorator';
import { UserRole } from '../users/entities/user.entity';
import { ErrorResponseDto } from '../../common/dto/error-response.dto';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { User } from '../users/entities/user.entity';
import { ChangePasswordDto } from './dto/change-password.dto';
import { MailService } from '../mail/mail.service';
import { AuditService } from '../audit/audit.service';

@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  private readonly logger = new Logger(AuthController.name);

  constructor(
    private readonly authService: AuthService,
    private readonly usersService: UsersService,
    private readonly mailService: MailService,
    private readonly auditService: AuditService,
  ) {}

  @Post('login')
  @ApiOperation({
    summary: 'Login',
    description: 'Authenticate with email, password, and role. Returns JWT access and refresh tokens.',
  })
  @ApiBody({ type: LoginDto, description: 'Credentials and portal role' })
  @ApiResponse({
    status: 200,
    description: 'Login successful',
    type: LoginResponseDto,
    schema: {
      example: {
        accessToken: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
        refreshToken: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
        expiresIn: 900,
        user: {
          id: '550e8400-e29b-41d4-a716-446655440000',
          email: 'admin@trilink.edu',
          role: 'admin',
          firstName: 'System',
          lastName: 'Admin',
          mustChangePassword: false,
        },
      },
    },
  })
  @ApiResponse({
    status: 401,
    description: 'Invalid email, password, or role mismatch',
    type: ErrorResponseDto,
    schema: { example: { statusCode: 401, error: 'Unauthorized', message: 'Invalid email or password' } },
  })
  @ApiResponse({ status: 400, description: 'Validation error (e.g. invalid email format)', type: ErrorResponseDto })
  async login(@Body() dto: LoginDto): Promise<TokenResponse> {
    return this.authService.login(dto);
  }

  @Post('refresh')
  @ApiOperation({
    summary: 'Refresh tokens',
    description: 'Exchange a valid refresh token for a new access token and refresh token.',
  })
  @ApiBody({ type: RefreshTokenDto })
  @ApiResponse({
    status: 200,
    description: 'New tokens issued',
    type: LoginResponseDto,
    schema: {
      example: {
        accessToken: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
        refreshToken: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
        expiresIn: 900,
        user: {
          id: '550e8400-e29b-41d4-a716-446655440000',
          email: 'admin@trilink.edu',
          role: 'admin',
          firstName: 'System',
          lastName: 'Admin',
          mustChangePassword: false,
        },
      },
    },
  })
  @ApiResponse({
    status: 401,
    description: 'Invalid or expired refresh token',
    type: ErrorResponseDto,
    schema: { example: { statusCode: 401, error: 'Unauthorized', message: 'Invalid or expired refresh token' } },
  })
  async refresh(@Body() dto: RefreshTokenDto): Promise<TokenResponse> {
    return this.authService.refresh(dto.refreshToken);
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('JWT')
  @ApiOperation({
    summary: 'Current user profile',
    description: 'Returns the authenticated user (no password). Use after login or to refresh client-side profile.',
  })
  @ApiResponse({ status: 200, description: 'Public user fields' })
  @ApiResponse({ status: 401, description: 'Missing or invalid JWT', type: ErrorResponseDto })
  me(@CurrentUser() user: User) {
    return this.usersService.toPublic(user);
  }

  @Post('change-password')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('JWT')
  @ApiOperation({
    summary: 'Change password',
    description: 'Requires current password. Clears mustChangePassword after success.',
  })
  @ApiBody({ type: ChangePasswordDto })
  @ApiResponse({ status: 200, schema: { example: { ok: true } } })
  @ApiResponse({ status: 401, description: 'Wrong current password', type: ErrorResponseDto })
  @ApiResponse({ status: 400, description: 'Validation or same-as-current password', type: ErrorResponseDto })
  async changePassword(@CurrentUser() user: User, @Body() dto: ChangePasswordDto) {
    const res = await this.usersService.changePassword(user.id, dto.currentPassword, dto.newPassword);
    try {
      await this.auditService.log(user.id, 'user.password_change', 'user', user.id);
    } catch (e) {
      this.logger.warn('Audit log skipped (password change)', e instanceof Error ? e.message : e);
    }
    return res;
  }

  @Post('register')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @ApiBearerAuth('JWT')
  @ApiOperation({
    summary: 'Register user (admin only)',
    description:
      'Register a new student, teacher, or parent. Requires admin JWT. Optional tempPassword; if omitted, server generates one. Role-specific fields: student (grade, section), teacher (subject, department), parent (linkedStudentId + relationship to link unambiguously, or register without link and use POST /parent-students). childName is optional display only.',
  })
  @ApiBody({
    type: RegisterByAdminDto,
    examples: {
      student: {
        summary: 'Register student',
        value: {
          email: 'student@school.edu',
          firstName: 'John',
          lastName: 'Doe',
          phone: '+251911234567',
          type: 'student',
          grade: 'Grade 9',
          section: 'A',
        },
      },
      teacher: {
        summary: 'Register teacher',
        value: {
          email: 'teacher@school.edu',
          firstName: 'Jane',
          lastName: 'Smith',
          phone: '+251922345678',
          type: 'teacher',
          subject: 'Mathematics',
          department: 'Science',
        },
      },
      parent: {
        summary: 'Register parent (link by student id)',
        value: {
          email: 'parent@example.com',
          firstName: 'Abebe',
          lastName: 'Kebede',
          phone: '+251933456789',
          type: 'parent',
          linkedStudentId: '550e8400-e29b-41d4-a716-446655440002',
          relationship: 'Father',
          isPrimaryLink: true,
        },
      },
    },
  })
  @ApiResponse({
    status: 201,
    description: 'User registered successfully',
    type: RegisterResponseDto,
    schema: {
      example: {
        id: '550e8400-e29b-41d4-a716-446655440001',
        email: 'student@school.edu',
        role: 'student',
        firstName: 'John',
        lastName: 'Doe',
        mustChangePassword: true,
        tempPassword: 'Ab12Cd34',
      },
    },
  })
  @ApiResponse({
    status: 401,
    description: 'Missing or invalid JWT',
    type: ErrorResponseDto,
    schema: { example: { statusCode: 401, error: 'Unauthorized', message: 'Unauthorized' } },
  })
  @ApiResponse({
    status: 403,
    description: 'Forbidden – caller is not an admin',
    type: ErrorResponseDto,
    schema: { example: { statusCode: 403, error: 'Forbidden', message: 'Forbidden resource' } },
  })
  @ApiResponse({
    status: 409,
    description: 'Email or phone already registered',
    type: ErrorResponseDto,
    schema: {
      example: {
        statusCode: 409,
        error: 'Conflict',
        message: 'User with this email already exists',
      },
    },
  })
  @ApiResponse({
    status: 503,
    description: 'SMTP configured but welcome email failed; registration was rolled back',
    type: ErrorResponseDto,
  })
  @ApiResponse({ status: 400, description: 'Validation error', type: ErrorResponseDto })
  async registerByAdmin(@CurrentUser() admin: User, @Body() dto: RegisterByAdminDto) {
    const user = await this.usersService.registerByAdmin(dto);
    const tempPassword = (user as any).tempPassword as string | undefined;

    let registrationEmailSent = false;
    if (this.mailService.isConfigured()) {
      try {
        await this.mailService.sendRegistrationCredentials(
          user.email,
          user.firstName,
          tempPassword ?? '',
          user.role,
        );
        registrationEmailSent = true;
      } catch (err) {
        this.logger.error('Registration welcome email failed', err instanceof Error ? err.stack : err);
        await this.usersService.rollbackRegistration(user.id);
        throw new ServiceUnavailableException(
          'Welcome email could not be sent. Registration was not completed. Check SMTP settings.',
        );
      }
    }

    const response: Record<string, unknown> = {
      id: user.id,
      email: user.email,
      role: user.role,
      firstName: user.firstName,
      lastName: user.lastName,
      mustChangePassword: user.mustChangePassword,
      registrationEmailSent,
    };
    if (tempPassword !== undefined) {
      response.tempPassword = tempPassword;
    }
    try {
      await this.auditService.log(
        admin.id,
        'user.register',
        'user',
        user.id,
        JSON.stringify({
          email: user.email,
          role: user.role,
          name: `${user.firstName} ${user.lastName}`.trim(),
        }),
      );
    } catch (e) {
      this.logger.warn('Audit log skipped (register)', e instanceof Error ? e.message : e);
    }
    return response;
  }
}
