import { ApiProperty } from '@nestjs/swagger';
import { IsUUID } from 'class-validator';

export class AssignHomeroomDto {
  @ApiProperty({ description: 'Teacher UUID' })
  @IsUUID()
  teacherId: string;

  @ApiProperty({ description: 'Academic year UUID' })
  @IsUUID()
  academicYearId: string;

  @ApiProperty({ description: 'Grade UUID' })
  @IsUUID()
  gradeId: string;

  @ApiProperty({ description: 'Section UUID' })
  @IsUUID()
  sectionId: string;
}
