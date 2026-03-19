import { Body, Controller, Post, UseGuards } from '@nestjs/common';
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

@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly usersService: UsersService,
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

  @Post('register')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @ApiBearerAuth('JWT')
  @ApiOperation({
    summary: 'Register user (admin only)',
    description: 'Register a new student, teacher, or parent. Requires admin JWT. Optional tempPassword; if omitted, server generates one. Role-specific fields: student (grade, section), teacher (subject, department), parent (childName, relationship).',
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
        summary: 'Register parent',
        value: {
          email: 'parent@example.com',
          firstName: 'Abebe',
          lastName: 'Kebede',
          phone: '+251933456789',
          type: 'parent',
          childName: 'John Doe',
          relationship: 'Father',
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
    description: 'Email already registered',
    type: ErrorResponseDto,
    schema: { example: { statusCode: 409, error: 'Conflict', message: 'User with this email already exists' } },
  })
  @ApiResponse({ status: 400, description: 'Validation error', type: ErrorResponseDto })
  async registerByAdmin(@Body() dto: RegisterByAdminDto) {
    const user = await this.usersService.registerByAdmin(dto);
    const response: Record<string, unknown> = {
      id: user.id,
      email: user.email,
      role: user.role,
      firstName: user.firstName,
      lastName: user.lastName,
      mustChangePassword: user.mustChangePassword,
    };
    if ((user as any).tempPassword) {
      response.tempPassword = (user as any).tempPassword;
    }
    return response;
  }
}
