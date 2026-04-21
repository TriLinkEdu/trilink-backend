import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class TextbookResponseDto {
  @ApiProperty({ example: 'a2d4b4df-34e2-4a6f-9bc4-5c9de1f75b8a' })
  id: string;

  @ApiProperty({ example: 'Grade 9 Mathematics — New Curriculum' })
  title: string;

  @ApiProperty({ example: 'Mathematics' })
  subject: string;

  @ApiProperty({ example: 9 })
  grade: number;

  @ApiPropertyOptional({ example: 'Official Ethiopian Grade 9 student textbook' })
  description: string | null;

  @ApiPropertyOptional({ example: 350 })
  pageCount: number | null;

  @ApiPropertyOptional({ example: 19070511 })
  sizeBytes: number | null;

  @ApiProperty({ example: true })
  isActive: boolean;

  @ApiProperty({ example: '4a5e4af2-3df1-4fd0-8cf4-1b26b5ef84cd' })
  fileRecordId: string;

  @ApiPropertyOptional({ example: '1730281888' })
  fileVersion: string | null;

  @ApiPropertyOptional({ example: '8bf0df2731f8a4c2b6a1ea22dcf0c34c' })
  fileEtag: string | null;

  @ApiProperty({ example: '4a5e4af2-3df1-4fd0-8cf4-1b26b5ef84cd:1730281888' })
  cacheKey: string;

  @ApiProperty({ example: 'https://res.cloudinary.com/dekmg6rhe/raw/upload/v.../textbooks/mathematics/grade-9.pdf' })
  accessUrl: string;

  @ApiPropertyOptional({ example: 'https://res.cloudinary.com/dekmg6rhe/image/upload/v.../textbooks/mathematics/grade-9-cover.png' })
  coverUrl: string | null;

  @ApiProperty({ example: '2026-04-21T07:00:00.000Z' })
  createdAt: string;
}
