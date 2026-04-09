import { Body, Controller, Delete, Get, Param, ParseUUIDPipe, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsOptional, IsString, IsUUID, MinLength } from 'class-validator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { User, UserRole } from '../users/entities/user.entity';
import { ParentStudentsService } from './parent-students.service';
import { CurrentUser } from '@/common/decorators/current-user.decorator';

class LinkDto {
  @ApiProperty() @IsUUID() parentId: string;
  @ApiProperty() @IsUUID() studentId: string;
  @ApiProperty({ example: 'Father' }) @IsString() @MinLength(1) relationship: string;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() isPrimary?: boolean;
}

@ApiTags('Parents')
@Controller('parent-students')
@UseGuards(JwtAuthGuard, RolesGuard)

@ApiBearerAuth('JWT')
export class ParentStudentsController {
  constructor(private readonly svc: ParentStudentsService) {}

  @Get()
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'List parent-student links' })
  list(@Query('parentId') parentId?: string, @Query('studentId') studentId?: string) {
    return this.svc.list({ parentId, studentId });
  }

  @Post()
  @Roles(UserRole.ADMIN)
  create(@Body() dto: LinkDto) {
    return this.svc.create(dto);
  }

  @Get('/mychildren')
  @Roles(UserRole.PARENT)
  @ApiOperation({ summary: 'List my children' })
  myChildren(@CurrentUser() user: User) {
    const parentId = user.id;
    return this.svc.myChildren(parentId);
  }

  @Delete(':id')
  @Roles(UserRole.ADMIN)
  async del(@Param('id', ParseUUIDPipe) id: string) {
    await this.svc.remove(id);
    return { ok: true };
  }
}
