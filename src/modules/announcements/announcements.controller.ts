import { Body, Controller, Delete, Get, Param, ParseUUIDPipe, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, IsUUID } from 'class-validator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole } from '../users/entities/user.entity';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { User } from '../users/entities/user.entity';
import { AnnouncementsService } from './announcements.service';

class AnnDto {
  @ApiProperty() @IsUUID() academicYearId: string;
  @ApiProperty() @IsString() title: string;
  @ApiProperty() @IsString() body: string;
  @ApiProperty({ example: 'all' }) @IsString() audience: string;
  @ApiPropertyOptional() @IsOptional() @IsUUID() classOfferingId?: string;
}

@ApiTags('Announcements')
@Controller('announcements')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth('JWT')
export class AnnouncementsController {
  constructor(private readonly svc: AnnouncementsService) {}

  @Get('for-me')
  @Roles(UserRole.ADMIN, UserRole.TEACHER, UserRole.STUDENT, UserRole.PARENT)
  @ApiOperation({ summary: 'Announcements visible to current user' })
  forMe(@CurrentUser() user: User) {
    return this.svc.forUser(user);
  }

  @Get()
  @Roles(UserRole.ADMIN, UserRole.TEACHER)
  list(@Query('academicYearId') academicYearId?: string) {
    return this.svc.list(academicYearId);
  }

  @Post()
  @Roles(UserRole.ADMIN, UserRole.TEACHER)
  create(@Body() dto: AnnDto, @CurrentUser() user: User) {
    return this.svc.create({ ...dto, authorId: user.id });
  }

  @Delete(':id')
  @Roles(UserRole.ADMIN)
  async del(@Param('id', ParseUUIDPipe) id: string) {
    await this.svc.remove(id);
    return { ok: true };
  }
}
