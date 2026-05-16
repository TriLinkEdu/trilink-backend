import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, IsUUID } from 'class-validator';

export class CreateRemarkDto {
  @ApiProperty({ description: 'Student UUID' })
  @IsUUID()
  studentId: string;

  @ApiProperty({ description: 'Term UUID' })
  @IsUUID()
  termId: string;

  @ApiProperty({ description: "Homeroom teacher's overall remark for the student" })
  @IsString()
  remark: string;

  @ApiPropertyOptional({ description: 'Conduct grade, e.g. "A", "B+", "Excellent"' })
  @IsOptional()
  @IsString()
  conductGrade?: string;
}
