import { ApiProperty } from '@nestjs/swagger';
import { IsBoolean, IsOptional, IsString, Length, Matches } from 'class-validator';

export class CreateAcademicYearDto {
  @ApiProperty({ example: '2025/2026' })
  @IsString()
  @Length(4, 32)
  label: string;

  @ApiProperty({ example: '2025-09-01', description: 'ISO date YYYY-MM-DD' })
  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  startDate: string;

  @ApiProperty({ example: '2026-06-30' })
  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  endDate: string;

  @ApiProperty({ required: false, default: false })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
