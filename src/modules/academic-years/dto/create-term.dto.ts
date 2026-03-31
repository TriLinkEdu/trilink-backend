import { ApiProperty } from '@nestjs/swagger';
import { IsString, Length, Matches } from 'class-validator';

export class CreateTermDto {
  @ApiProperty({ example: 'Term 1' })
  @IsString()
  @Length(1, 120)
  name: string;

  @ApiProperty({ example: '2025-09-01' })
  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  startDate: string;

  @ApiProperty({ example: '2025-12-20' })
  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  endDate: string;
}
