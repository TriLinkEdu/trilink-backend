import { ApiProperty } from '@nestjs/swagger';
import { IsUUID } from 'class-validator';

export class InitiateChatDto {
  @ApiProperty({
    description: 'User ID to start a direct conversation with',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @IsUUID()
  targetUserId: string;
}
