import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole } from '../users/entities/user.entity';
import { AuditService } from './audit.service';

@ApiTags('Admin')
@Controller('audit-logs')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN)
@ApiBearerAuth('JWT')
export class AuditController {
  constructor(private readonly audit: AuditService) {}

  @Get()
  @ApiOperation({ summary: 'Recent audit entries' })
  list(@Query('limit') limit?: string) {
    return this.audit.list(limit ? parseInt(limit, 10) : 100);
  }
}
