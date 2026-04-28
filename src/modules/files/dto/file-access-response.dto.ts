import { ApiProperty } from '@nestjs/swagger';

export class FileAccessResponseDto {
  @ApiProperty({ example: 'a2d4b4df-34e2-4a6f-9bc4-5c9de1f75b8a' })
  id: string;

  @ApiProperty({ example: 'Physics_Textbook_Chapter_1.pdf' })
  filename: string;

  @ApiProperty({ example: 'application/pdf' })
  mime: string;

  @ApiProperty({ example: 'cloudinary' })
  storageProvider: string;

  @ApiProperty({ example: 'trilink_uploads/textbook/chapter-1' })
  storageKey: string | null;

  @ApiProperty({ example: 'v1730281888' })
  version: string | null;

  @ApiProperty({ example: '8bf0df2731f8a4c2b6a1ea22dcf0c34c' })
  etag: string | null;

  @ApiProperty({ example: 1024000, nullable: true })
  sizeBytes: number | null;

  @ApiProperty({ example: 'https://res.cloudinary.com/.../file.pdf' })
  accessUrl: string;

  @ApiProperty({ example: 'a2d4b4df-34e2-4a6f-9bc4-5c9de1f75b8a:v1730281888' })
  cacheKey: string;

  @ApiProperty({ example: 3600 })
  expiresInSeconds: number;
}
