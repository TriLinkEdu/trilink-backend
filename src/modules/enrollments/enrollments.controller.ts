import { Body, Controller, Delete, Get, Param, ParseUUIDPipe, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { ApiProperty } from '@nestjs/swagger';
import { IsUUID } from 'class-validator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole } from '../users/entities/user.entity';
import { EnrollmentsService } from './enrollments.service';

class EnrollDto {
  @ApiProperty() @IsUUID() studentId: string;
  @ApiProperty() @IsUUID() classOfferingId: string;
  @ApiProperty() @IsUUID() academicYearId: string;
}

@ApiTags('Enrollments')
@Controller('enrollments')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth('JWT')
export class EnrollmentsController {
  constructor(private readonly svc: EnrollmentsService) {}

  @Get()
  @Roles(UserRole.ADMIN, UserRole.TEACHER)
  @ApiOperation({ summary: 'List enrollments (admin / teacher)' })
  list(
    @Query('studentId') studentId?: string,
    @Query('classOfferingId') classOfferingId?: string,
    @Query('academicYearId') academicYearId?: string,
  ) {
    return this.svc.list({ studentId, classOfferingId, academicYearId });
  }

  @Post()
  @Roles(UserRole.ADMIN)
  create(@Body() dto: EnrollDto) {
    return this.svc.create(dto);
  }

  @Delete(':id')
  @Roles(UserRole.ADMIN)
  async del(@Param('id', ParseUUIDPipe) id: string) {
    await this.svc.remove(id);
    return { ok: true };
  }
}
