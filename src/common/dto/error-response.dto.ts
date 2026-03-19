import { ApiProperty } from '@nestjs/swagger';

/**
 * Standard error response body (4xx, 5xx).
 */
export class ErrorResponseDto {
  @ApiProperty({ example: 401, description: 'HTTP status code' })
  statusCode: number;

  @ApiProperty({ example: 'Unauthorized', description: 'Error type' })
  error: string;

  @ApiProperty({
    example: 'Invalid email or password',
    description: 'Human-readable message (or array of validation messages for 400)',
  })
  message: string | string[];
}
