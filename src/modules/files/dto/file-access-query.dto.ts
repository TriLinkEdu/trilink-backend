import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsInt, IsOptional, Max, Min } from 'class-validator';

export class FileAccessQueryDto {
  @ApiPropertyOptional({
    description: 'Signed URL lifetime in seconds. Capped by server policy.',
    minimum: 60,
    maximum: 86400,
    default: 3600,
  })
  @IsOptional()
  @IsInt()
  @Min(60)
  @Max(86400)
  expiresInSeconds?: number;
}
