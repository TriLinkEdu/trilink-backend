import { Controller, Get, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole } from '../users/entities/user.entity';
import { AnalyticsService } from './analytics.service';

@ApiTags('Analytics')
@Controller('analytics')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN)
@ApiBearerAuth('JWT')
export class AnalyticsController {
  constructor(private readonly analytics: AnalyticsService) {}

  @Get('admin/summary')
  @ApiOperation({
    summary: 'School-wide analytics snapshot',
    description: 'Aggregates feedback, exams, attempts, attendance marks (last 30 days), users.',
  })
  summary() {
    return this.analytics.adminSummary();
  }
}
