import { ApiProperty } from '@nestjs/swagger';
import { IsArray, IsUUID } from 'class-validator';

export class AddMembersDto {
  @ApiProperty({ type: [String], description: 'Array of user UUIDs to add' })
  @IsArray()
  @IsUUID('4', { each: true })
  userIds: string[];
}
