import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsOptional, IsString, Length, Matches } from 'class-validator';

export class UpdateAcademicYearDto {
  @ApiPropertyOptional({ example: '2025/2026' })
  @IsOptional()
  @IsString()
  @Length(4, 32)
  label?: string;

  @ApiPropertyOptional({ example: '2025-09-01' })
  @IsOptional()
  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  startDate?: string;

  @ApiPropertyOptional({ example: '2026-06-30' })
  @IsOptional()
  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  endDate?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isArchived?: boolean;
}
