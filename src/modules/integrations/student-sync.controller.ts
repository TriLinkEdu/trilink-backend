import { Controller, Get, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole } from '../users/entities/user.entity';

type SyncStatus = 'synced' | 'pending' | 'error';

interface SyncItemDto {
  id: string;
  category: string;
  description: string;
  status: SyncStatus;
  lastSyncedAt: string;
  pendingCount: number;
}

@ApiTags('Integrations')
@Controller('sync/student')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN, UserRole.TEACHER, UserRole.STUDENT, UserRole.PARENT)
@ApiBearerAuth('JWT')
export class StudentSyncController {
  @Get('status')
  @ApiOperation({
    summary: 'Student sync status overview',
    description: 'Lightweight status endpoint for mobile sync dashboard.',
  })
  status() {
    const now = new Date().toISOString();
    return {
      generatedAt: now,
      items: this.defaultItems(now),
    };
  }

  @Post('trigger')
  @ApiOperation({
    summary: 'Trigger student sync',
    description: 'Acknowledges sync action and returns refreshed status.',
  })
  trigger() {
    const now = new Date().toISOString();
    return {
      triggeredAt: now,
      items: this.defaultItems(now),
    };
  }

  private defaultItems(ts: string): SyncItemDto[] {
    return [
      {
        id: 'sync-api',
        category: 'API Link',
        description: 'Authentication and transport status',
        status: 'synced',
        lastSyncedAt: ts,
        pendingCount: 0,
      },
      {
        id: 'sync-student-data',
        category: 'Student Data',
        description: 'Grades, attendance, announcements and exams',
        status: 'synced',
        lastSyncedAt: ts,
        pendingCount: 0,
      },
    ];
  }
}
