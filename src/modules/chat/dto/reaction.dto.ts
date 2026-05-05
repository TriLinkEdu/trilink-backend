import { ApiProperty } from '@nestjs/swagger';
import { IsString, MinLength, MaxLength } from 'class-validator';

export class ReactionDto {
  @ApiProperty({ description: 'Emoji character to toggle', example: '👍' })
  @IsString()
  @MinLength(1)
  @MaxLength(8)
  emoji: string;
}
