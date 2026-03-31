import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsEmail, IsEnum, IsOptional, IsString, IsUUID, MinLength, ValidateIf } from 'class-validator';

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

  @ApiPropertyOptional({
    description:
      'Optional label only — never unique. To tie this parent to a student, use linkedStudentId (and relationship) or POST /parent-students after register.',
  })
  @IsOptional()
  @IsString()
  childName?: string;

  @ApiPropertyOptional({
    description:
      'Student user id to link when registering a parent. Use this instead of childName so the correct student is chosen when names duplicate.',
  })
  @ValidateIf((o) => o.type === RegisterRole.PARENT)
  @IsOptional()
  @IsUUID()
  linkedStudentId?: string;

  @ApiPropertyOptional({
    example: 'Father',
    description: 'Relationship to the student. Required when linkedStudentId is set; stored on the parent–student link.',
    enum: ['Father', 'Mother', 'Guardian'],
  })
  @ValidateIf((o) => o.type === RegisterRole.PARENT && !!o.linkedStudentId)
  @IsString()
  @MinLength(1)
  relationship?: string;

  @ApiPropertyOptional({
    description: 'When linkedStudentId is set: mark this link as primary (default false).',
  })
  @ValidateIf((o) => o.type === RegisterRole.PARENT && !!o.linkedStudentId)
  @IsOptional()
  @IsBoolean()
  isPrimaryLink?: boolean;

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
