import { Controller, Get, UseGuards } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole } from '../users/entities/user.entity';

@ApiTags('Integrations')
@Controller('integrations')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN, UserRole.TEACHER)
@ApiBearerAuth('JWT')
export class IntegrationsController {
  constructor(private readonly config: ConfigService) {}

  @Get('status')
  @ApiOperation({
    summary: 'External services configuration (no secrets returned)',
    description:
      'Shows whether MongoDB, vector search, and AI worker URLs are set. Wire env vars when you add those systems.',
  })
  status() {
    const mongoUri = process.env.MONGO_URI || process.env.MONGODB_URI || '';
    const vectorUrl = process.env.VECTOR_SERVICE_URL || '';
    const aiUrl = process.env.AI_SERVICE_URL || '';
    return {
      mongoDb: {
        configured: mongoUri.length > 0,
        hint: 'Set MONGO_URI or MONGODB_URI to enable a second store (e.g. unstructured blobs).',
      },
      vectorSearch: {
        configured: vectorUrl.length > 0,
        hint: 'Set VECTOR_SERVICE_URL for embeddings / semantic search gateway.',
      },
      aiWorker: {
        configured: aiUrl.length > 0,
        hint: 'Set AI_SERVICE_URL; Nest AI routes can proxy to Python/ML.',
      },
      apiPrefix: this.config.get<string>('apiPrefix') ?? 'api',
      serverTime: new Date().toISOString(),
    };
  }

  @Get('sync-hints')
  @ApiOperation({
    summary: 'Hints for offline / sync clients',
    description: 'Version and time only; clients implement PWA/cache policy.',
  })
  syncHints() {
    return {
      apiVersion: '1.0.0',
      serverTime: new Date().toISOString(),
      note: 'Use If-None-Match / updatedAt per resource when you add ETag support.',
    };
  }
}
