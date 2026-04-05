import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiProperty, ApiTags } from '@nestjs/swagger';
import { IsIn, IsOptional, IsString, IsUUID, MinLength } from 'class-validator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { User, UserRole } from '../users/entities/user.entity';
import { NotificationsService, BroadcastAudience } from './notifications.service';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';

class BroadcastDto {
  @ApiProperty() @IsString() @MinLength(1) title: string;
  @ApiProperty() @IsString() @MinLength(1) body: string;
  @ApiProperty({ enum: ['class', 'all_students'] })
  @IsIn(['class', 'all_students'])
  audience: BroadcastAudience;

  @ApiProperty({ required: false, description: 'Required when audience is class' })
  @IsOptional()
  @IsUUID()
  classOfferingId?: string;
}

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

  @Post('broadcast')
  @Roles(UserRole.ADMIN, UserRole.TEACHER)
  @ApiOperation({
    summary: 'Broadcast notification to a class (teacher owner or admin) or all students (admin only)',
  })
  broadcast(@CurrentUser() user: User, @Body() dto: BroadcastDto) {
    return this.svc.broadcastFromStaff(user, dto);
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
