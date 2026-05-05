import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, IsUUID, MinLength } from 'class-validator';

export class SendMessageDto {
  @ApiPropertyOptional({ description: 'Message text (required if no mediaFileId)' })
  @IsOptional()
  @IsString()
  @MinLength(1)
  text?: string;

  @ApiPropertyOptional({ description: 'UUID of the message being replied to' })
  @IsOptional()
  @IsUUID()
  replyToId?: string;

  @ApiPropertyOptional({ description: 'UUID of the uploaded FileRecord for media' })
  @IsOptional()
  @IsUUID()
  mediaFileId?: string;
}
