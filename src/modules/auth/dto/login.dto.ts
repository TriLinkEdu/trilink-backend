import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsEnum, IsString, MinLength } from 'class-validator';

export enum LoginRole {
  ADMIN = 'admin',
  TEACHER = 'teacher',
  STUDENT = 'student',
  PARENT = 'parent',
}

export class LoginDto {
  @ApiProperty({
    example: 'admin@trilink.edu',
    description: 'User email address',
  })
  @IsEmail()
  email: string;

  @ApiProperty({
    example: 'Admin@123',
    description: 'User password (min 6 characters)',
    minLength: 6,
  })
  @IsString()
  @MinLength(6)
  password: string;

  @ApiProperty({
    enum: LoginRole,
    example: LoginRole.ADMIN,
    description: 'Portal role; must match the account type (admin, teacher, student, parent)',
  })
  @IsEnum(LoginRole)
  role: LoginRole;
}
