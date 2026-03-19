import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class RegisterResponseDto {
  @ApiProperty({ example: '550e8400-e29b-41d4-a716-446655440001', description: 'Created user ID' })
  id: string;

  @ApiProperty({ example: 'student@school.edu' })
  email: string;

  @ApiProperty({ example: 'student', enum: ['student', 'teacher', 'parent'] })
  role: string;

  @ApiProperty({ example: 'John' })
  firstName: string;

  @ApiProperty({ example: 'Doe' })
  lastName: string;

  @ApiProperty({ example: true, description: 'User must change temporary password on first login' })
  mustChangePassword: boolean;

  @ApiPropertyOptional({
    example: 'Ab12Cd34',
    description: 'Temporary password (only when server generated it; share securely with the user)',
  })
  tempPassword?: string;
}
