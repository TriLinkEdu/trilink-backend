import { Body, Controller, Delete, Get, Param, ParseUUIDPipe, Patch, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiProperty, ApiPropertyOptional, ApiTags } from '@nestjs/swagger';
import { IsNumber, IsOptional, IsString, Max, Min, MinLength } from 'class-validator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole } from '../users/entities/user.entity';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { User } from '../users/entities/user.entity';
import { GoalsService } from './goals.service';

class CreateGoalDto {
  @ApiProperty() @IsString() @MinLength(1) title: string;
  @ApiPropertyOptional() @IsOptional() @IsString() description?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() targetDate?: string;
}

class PatchGoalDto {
  @ApiPropertyOptional() @IsOptional() @IsString() title?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() description?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() targetDate?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() status?: string;
  @ApiPropertyOptional() @IsOptional() @IsNumber() @Min(0) @Max(100) progressPercent?: number;
}

@ApiTags('Student goals')
@Controller('goals')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth('JWT')
export class GoalsController {
  constructor(private readonly goals: GoalsService) {}

  @Get('me')
  @Roles(UserRole.STUDENT)
  @ApiOperation({ summary: 'My goals' })
  myList(@CurrentUser() user: User) {
    return this.goals.listForStudent(user.id, user);
  }

  @Post('me')
  @Roles(UserRole.STUDENT)
  @ApiOperation({ summary: 'Create my goal' })
  myCreate(@CurrentUser() user: User, @Body() dto: CreateGoalDto) {
    return this.goals.create(user.id, user, dto as any);
  }

  @Get('students/:studentId')
  @Roles(UserRole.ADMIN, UserRole.TEACHER, UserRole.STUDENT, UserRole.PARENT)
  @ApiOperation({ summary: 'Goals for a student (self, linked parent, staff)' })
  listForStudent(@Param('studentId', ParseUUIDPipe) studentId: string, @CurrentUser() user: User) {
    return this.goals.listForStudent(studentId, user);
  }

  @Patch(':goalId')
  @Roles(UserRole.STUDENT)
  patch(@Param('goalId', ParseUUIDPipe) goalId: string, @CurrentUser() user: User, @Body() dto: PatchGoalDto) {
    return this.goals.patch(goalId, user, dto);
  }

  @Delete(':goalId')
  @Roles(UserRole.STUDENT)
  del(@Param('goalId', ParseUUIDPipe) goalId: string, @CurrentUser() user: User) {
    return this.goals.remove(goalId, user);
  }
}
