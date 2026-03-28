import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, IsUUID } from 'class-validator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole } from '../users/entities/user.entity';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { User } from '../users/entities/user.entity';
import { ClassOfferingsService } from './class-offerings.service';

class CreateOfferingDto {
  @ApiProperty() @IsUUID() academicYearId: string;
  @ApiProperty() @IsUUID() gradeId: string;
  @ApiProperty() @IsUUID() sectionId: string;
  @ApiProperty() @IsUUID() subjectId: string;
  @ApiProperty() @IsUUID() teacherId: string;
  @ApiPropertyOptional() @IsOptional() @IsString() name?: string;
}

@ApiTags('Classes')
@Controller('class-offerings')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth('JWT')
export class ClassOfferingsController {
  constructor(private readonly svc: ClassOfferingsService) {}

  @Get('mine')
  @Roles(UserRole.TEACHER, UserRole.ADMIN)
  @ApiOperation({
    summary: 'My class offerings (teacher)',
    description: 'Admin may pass teacherId to inspect another teacher’s schedule.',
  })
  @ApiQuery({ name: 'academicYearId', required: true })
  @ApiQuery({ name: 'teacherId', required: false, description: 'Admin only' })
  listMine(
    @CurrentUser() user: User,
    @Query('academicYearId') academicYearId: string,
    @Query('teacherId') teacherId?: string,
  ) {
    if (!academicYearId) throw new BadRequestException('academicYearId query required');
    const tid = user.role === UserRole.ADMIN && teacherId ? teacherId : user.id;
    return this.svc.listForTeacher(tid, academicYearId);
  }

  @Get()
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'List offerings by academic year (admin)' })
  list(@Query('academicYearId') academicYearId: string) {
    if (!academicYearId) throw new BadRequestException('academicYearId query required');
    return this.svc.list(academicYearId);
  }

  @Get(':id')
  @Roles(UserRole.ADMIN)
  one(@Param('id', ParseUUIDPipe) id: string) {
    return this.svc.one(id);
  }

  @Post()
  @Roles(UserRole.ADMIN)
  create(@Body() dto: CreateOfferingDto) {
    return this.svc.create(dto);
  }

  @Patch(':id')
  @Roles(UserRole.ADMIN)
  patch(@Param('id', ParseUUIDPipe) id: string, @Body() body: Partial<Pick<CreateOfferingDto, 'teacherId' | 'name'>>) {
    return this.svc.update(id, body);
  }

  @Delete(':id')
  @Roles(UserRole.ADMIN)
  async del(@Param('id', ParseUUIDPipe) id: string) {
    await this.svc.remove(id);
    return { ok: true };
  }
}
