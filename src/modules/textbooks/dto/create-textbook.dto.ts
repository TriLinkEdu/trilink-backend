import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsString, IsInt, IsOptional, Min, Max } from 'class-validator';
import { Type } from 'class-transformer';

export class CreateTextbookDto {
  @ApiProperty({ example: 'Grade 9 Mathematics — New Curriculum' })
  @IsNotEmpty()
  @IsString()
  title: string;

  @ApiProperty({ example: 'Mathematics', description: 'Subject name' })
  @IsNotEmpty()
  @IsString()
  subject: string;

  @ApiProperty({ example: 9, description: 'Grade level' })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(12)
  grade: number;

  @ApiPropertyOptional({ example: 'Official Ethiopian Grade 9 student textbook' })
  @IsOptional()
  @IsString()
  description?: string;

  // Swagger UI sometimes passes empty file parameters as text fields which triggers forbidNonWhitelisted.
  // Adding them here as optional whitelisted fields.
  @IsOptional()
  file?: any;

  @IsOptional()
  cover?: any;
}
