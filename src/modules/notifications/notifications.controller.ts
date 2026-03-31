import { Controller, Get, Param, ParseUUIDPipe, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { User } from '../users/entities/user.entity';
import { NotificationsService } from './notifications.service';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole } from '../users/entities/user.entity';

@ApiTags('Notifications')
@Controller('notifications')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN, UserRole.TEACHER, UserRole.STUDENT, UserRole.PARENT)
@ApiBearerAuth('JWT')
export class NotificationsController {
  constructor(private readonly svc: NotificationsService) {}

  @Get()
  @ApiOperation({ summary: 'My notifications' })
  list(@CurrentUser() user: User, @Query('unreadOnly') unreadOnly?: string) {
    return this.svc.listForUser(user.id, unreadOnly === 'true');
  }

  @Patch(':id/read')
  read(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: User) {
    return this.svc.markRead(id, user.id);
  }

  @Post('read-all')
  readAll(@CurrentUser() user: User) {
    return this.svc.markAllRead(user.id);
  }
}
