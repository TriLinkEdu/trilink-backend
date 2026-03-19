import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEmail, IsEnum, IsOptional, IsString, MinLength } from 'class-validator';

export enum RegisterRole {
  STUDENT = 'student',
  TEACHER = 'teacher',
  PARENT = 'parent',
}

export class RegisterByAdminDto {
  @ApiProperty({ example: 'student@school.edu', description: 'User email (must be unique)' })
  @IsEmail()
  email: string;

  @ApiProperty({ example: 'John', description: 'First name' })
  @IsString()
  @MinLength(1)
  firstName: string;

  @ApiProperty({ example: 'Doe', description: 'Last name' })
  @IsString()
  @MinLength(1)
  lastName: string;

  @ApiPropertyOptional({ example: '+251911234567', description: 'Phone number' })
  @IsOptional()
  @IsString()
  phone?: string;

  @ApiProperty({
    enum: RegisterRole,
    example: RegisterRole.STUDENT,
    description: 'Role to create: student, teacher, or parent',
  })
  @IsEnum(RegisterRole)
  type: RegisterRole;

  @ApiPropertyOptional({ example: 'Grade 9', description: 'Required for type=student' })
  @IsOptional()
  @IsString()
  grade?: string;

  @ApiPropertyOptional({ example: 'A', description: 'Required for type=student' })
  @IsOptional()
  @IsString()
  section?: string;

  @ApiPropertyOptional({ example: 'Mathematics', description: 'Required for type=teacher' })
  @IsOptional()
  @IsString()
  subject?: string;

  @ApiPropertyOptional({ example: 'Science', description: 'Required for type=teacher' })
  @IsOptional()
  @IsString()
  department?: string;

  @ApiPropertyOptional({ example: 'Jane Doe', description: 'Child full name; required for type=parent' })
  @IsOptional()
  @IsString()
  childName?: string;

  @ApiPropertyOptional({
    example: 'Father',
    description: 'Relationship to child; required for type=parent',
    enum: ['Father', 'Mother', 'Guardian'],
  })
  @IsOptional()
  @IsString()
  relationship?: string;

  @ApiPropertyOptional({
    example: 'TempPass123',
    description: 'Temporary password. If omitted, server generates one and returns it in the response.',
    minLength: 6,
  })
  @IsOptional()
  @IsString()
  @MinLength(6)
  tempPassword?: string;
}
