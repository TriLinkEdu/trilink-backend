import { ApiProperty } from '@nestjs/swagger';

export class UserInfoDto {
  @ApiProperty({ example: '550e8400-e29b-41d4-a716-446655440000', description: 'Unique user ID' })
  id: string;

  @ApiProperty({ example: 'admin@trilink.edu', description: 'User email' })
  email: string;

  @ApiProperty({ example: 'admin', enum: ['admin', 'teacher', 'student', 'parent'] })
  role: string;

  @ApiProperty({ example: 'System' })
  firstName: string;

  @ApiProperty({ example: 'Admin' })
  lastName: string;

  @ApiProperty({ example: false, description: 'If true, user should change password on next login' })
  mustChangePassword: boolean;
}

export class LoginResponseDto {
  @ApiProperty({
    example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
    description: 'JWT access token for Authorization header',
  })
  accessToken: string;

  @ApiProperty({
    example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
    description: 'JWT refresh token to obtain new access token',
  })
  refreshToken: string;

  @ApiProperty({ example: 900, description: 'Access token lifetime in seconds' })
  expiresIn: number;

  @ApiProperty({ type: UserInfoDto, description: 'Authenticated user info' })
  user: UserInfoDto;
}
