import {
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
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsDateString, IsOptional, IsString, IsUUID } from 'class-validator';
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
  @ApiPropertyOptional() @IsOptional() @IsString() targetGrade?: string;
  @ApiPropertyOptional({ description: 'ISO 8601 — hidden from students/parents until this time' })
  @IsOptional()
  @IsDateString()
  publishAt?: string;
}

class AnnPatchDto {
  @ApiPropertyOptional() @IsOptional() @IsString() title?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() body?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() audience?: string;
  @ApiPropertyOptional() @IsOptional() @IsUUID() classOfferingId?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() targetGrade?: string;
  @ApiPropertyOptional() @IsOptional() @IsDateString() publishAt?: string;
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
    const { publishAt, ...rest } = dto;
    return this.svc.create({
      ...rest,
      authorId: user.id,
      publishAt: publishAt ? new Date(publishAt) : null,
    });
  }

  @Patch(':id')
  @Roles(UserRole.ADMIN, UserRole.TEACHER)
  @ApiOperation({ summary: 'Update announcement (author or admin)' })
  patch(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: AnnPatchDto,
    @CurrentUser() user: User,
  ) {
    return this.svc.update(id, {
      title: dto.title,
      body: dto.body,
      audience: dto.audience,
      classOfferingId: dto.classOfferingId,
      targetGrade: dto.targetGrade,
      publishAt:
        dto.publishAt === undefined ? undefined : dto.publishAt ? new Date(dto.publishAt) : null,
    }, user);
  }

  @Delete(':id')
  @Roles(UserRole.ADMIN)
  async del(@Param('id', ParseUUIDPipe) id: string) {
    await this.svc.remove(id);
    return { ok: true };
  }
}
