import { Controller, Get, Param, ParseUUIDPipe, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole } from '../users/entities/user.entity';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { User } from '../users/entities/user.entity';
import { DashboardsService } from './dashboards.service';
import { ParentStudent } from '../parent-students/entities/parent-student.entity';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ForbiddenException } from '@nestjs/common';

@ApiTags('Dashboard')
@Controller('dashboard')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth('JWT')
export class DashboardsController {
  constructor(
    private readonly dash: DashboardsService,
    @InjectRepository(ParentStudent) private readonly psRepo: Repository<ParentStudent>,
  ) {}

  @Get('admin')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Admin summary counts' })
  admin() {
    return this.dash.admin();
  }

  @Get('teacher')
  @Roles(UserRole.TEACHER)
  teacher(@CurrentUser() user: User) {
    return this.dash.teacher(user.id);
  }

  @Get('student')
  @Roles(UserRole.STUDENT)
  student(@CurrentUser() user: User) {
    return this.dash.student(user.id);
  }

  @Get('parent')
  @Roles(UserRole.PARENT)
  parent(@CurrentUser() user: User) {
    return this.dash.parent(user.id);
  }

  @Get('children/:studentId/summary')
  @Roles(UserRole.PARENT, UserRole.ADMIN)
  @ApiOperation({ summary: 'Parent: high-level child summary (link check)' })
  async childSummary(@Param('studentId', ParseUUIDPipe) studentId: string, @CurrentUser() user: User) {
    if (user.role === UserRole.PARENT) {
      const link = await this.psRepo.findOne({ where: { parentId: user.id, studentId } });
      if (!link) throw new ForbiddenException('Not linked to this student');
    }
    return this.dash.student(studentId);
  }
}
