import { ApiProperty } from '@nestjs/swagger';
import { IsString, MinLength } from 'class-validator';

export class EditMessageDto {
  @ApiProperty({ description: 'New message text' })
  @IsString()
  @MinLength(1)
  text: string;
}
