import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CourseResourceDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  title: string;

  @ApiProperty()
  subjectId: string;

  @ApiProperty()
  subjectName: string;

  @ApiPropertyOptional()
  topicId?: string;

  @ApiProperty({ enum: ['pdf', 'video', 'link', 'document', 'presentation'] })
  type: string;

  @ApiProperty({ enum: ['easy', 'medium', 'hard'] })
  difficulty: string;

  @ApiPropertyOptional()
  description?: string;

  @ApiPropertyOptional()
  url?: string;

  @ApiPropertyOptional()
  fileSize?: string;

  @ApiPropertyOptional()
  textbookId?: string;

  @ApiPropertyOptional()
  textbookFileRecordId?: string;

  @ApiPropertyOptional()
  textbookCacheKey?: string;

  @ApiProperty()
  uploadedAt: string;
}
