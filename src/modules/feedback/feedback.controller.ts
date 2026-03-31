import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, MinLength } from 'class-validator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole } from '../users/entities/user.entity';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { User } from '../users/entities/user.entity';
import { FeedbackService } from './feedback.service';

class FCreate {
  @ApiProperty() @IsString() @MinLength(2) category: string;
  @ApiProperty() @IsString() @MinLength(1) message: string;
}
class FPatch {
  @ApiPropertyOptional() @IsOptional() @IsString() status?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() assigneeId?: string;
}

@ApiTags('Feedback')
@Controller('feedback')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth('JWT')
export class FeedbackController {
  constructor(private readonly svc: FeedbackService) {}

  @Post()
  @Roles(UserRole.STUDENT, UserRole.PARENT, UserRole.TEACHER)
  @ApiOperation({ summary: 'Submit feedback' })
  create(@Body() dto: FCreate, @CurrentUser() user: User) {
    return this.svc.create({ authorId: user.id, category: dto.category, message: dto.message });
  }

  @Get()
  @Roles(UserRole.ADMIN)
  list() {
    return this.svc.list();
  }

  @Patch(':id')
  @Roles(UserRole.ADMIN)
  patch(@Param('id', ParseUUIDPipe) id: string, @Body() dto: FPatch) {
    return this.svc.update(id, dto);
  }
}
