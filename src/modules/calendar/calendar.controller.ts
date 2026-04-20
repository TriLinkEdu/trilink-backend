import { Body, Controller, Delete, Get, Param, ParseUUIDPipe, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, IsUUID } from 'class-validator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole } from '../users/entities/user.entity';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { User } from '../users/entities/user.entity';
import { CalendarService } from './calendar.service';

class CreateEventDto {
  @ApiProperty() @IsUUID() academicYearId: string;
  @ApiProperty({ example: 'Math class' }) @IsString() title: string;
  @ApiProperty({ example: '2026-03-20' }) @IsString() date: string;
  @ApiPropertyOptional() @IsOptional() @IsString() time?: string;
  @ApiProperty({ example: 'class' }) @IsString() type: string;
  @ApiPropertyOptional() @IsOptional() @IsString() description?: string;
  @ApiPropertyOptional() @IsOptional() @IsUUID() classOfferingId?: string;
}

@ApiTags('Calendar')
@Controller('calendar-events')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth('JWT')
export class CalendarController {
  constructor(private readonly svc: CalendarService) {}

  @Get()
  @Roles(UserRole.ADMIN, UserRole.TEACHER, UserRole.STUDENT, UserRole.PARENT)
  @ApiOperation({
    summary: 'List events (staff: all; student/parent: school-wide + their class offerings)',
  })
  list(
    @CurrentUser() user: User,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('academicYearId') academicYearId?: string,
    @Query('classOfferingId') classOfferingId?: string,
  ) {
    return this.svc.listForViewer(user, { from, to, yearId: academicYearId, classOfferingId });
  }

  @Get(':id')
  @Roles(UserRole.ADMIN, UserRole.TEACHER, UserRole.STUDENT, UserRole.PARENT)
  @ApiOperation({
    summary: 'Get event by id for current viewer scope',
  })
  getById(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: User) {
    return this.svc.getForViewer(user, id);
  }

  @Post()
  @Roles(UserRole.ADMIN, UserRole.TEACHER)
  @ApiOperation({ summary: 'Create event (uses your user as createdBy)' })
  create(@Body() dto: CreateEventDto, @CurrentUser() user: User) {
    return this.svc.create({ ...dto, createdById: user.id });
  }

  @Patch(':id')
  @Roles(UserRole.ADMIN, UserRole.TEACHER)
  patch(@Param('id', ParseUUIDPipe) id: string, @Body() body: Partial<CreateEventDto>) {
    return this.svc.update(id, body);
  }

  @Delete(':id')
  @Roles(UserRole.ADMIN)
  async del(@Param('id', ParseUUIDPipe) id: string) {
    await this.svc.remove(id);
    return { ok: true };
  }
}
