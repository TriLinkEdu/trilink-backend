import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiPropertyOptional, ApiTags } from '@nestjs/swagger';
import { IsOptional, IsString, IsUUID } from 'class-validator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole } from '../users/entities/user.entity';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { User } from '../users/entities/user.entity';
import { StudentProfilesService } from './student-profiles.service';

class PatchProfileDto {
  @ApiPropertyOptional() @IsOptional() @IsString() bio?: string;
  @ApiPropertyOptional() @IsOptional() @IsUUID() avatarFileId?: string;
  @ApiPropertyOptional({ description: 'JSON string for interests, etc.' }) @IsOptional() @IsString() extraJson?: string;
}

@ApiTags('Student profiles')
@Controller('student-profiles')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth('JWT')
export class StudentProfilesController {
  constructor(private readonly profiles: StudentProfilesService) {}

  @Get('me')
  @Roles(UserRole.STUDENT)
  @ApiOperation({ summary: 'My extended profile' })
  me(@CurrentUser() user: User) {
    return this.profiles.getOrCreate(user.id);
  }

  @Patch('me')
  @Roles(UserRole.STUDENT)
  @ApiOperation({ summary: 'Update my profile' })
  patchMe(@CurrentUser() user: User, @Body() dto: PatchProfileDto) {
    return this.profiles.patchMe(user.id, user, dto);
  }

  @Get(':studentUserId')
  @Roles(UserRole.ADMIN, UserRole.TEACHER, UserRole.STUDENT, UserRole.PARENT)
  @ApiOperation({ summary: 'Student profile by user id (self, linked parent, staff)' })
  one(@Param('studentUserId', ParseUUIDPipe) studentUserId: string, @CurrentUser() user: User) {
    return this.profiles.getForViewer(studentUserId, user);
  }

  @Get(':studentUserId/detail')
  @Roles(UserRole.ADMIN, UserRole.TEACHER, UserRole.STUDENT, UserRole.PARENT)
  @ApiOperation({ summary: 'Student detail with profile, classes, subjects and teachers' })
  detail(@Param('studentUserId', ParseUUIDPipe) studentUserId: string, @CurrentUser() user: User) {
    return this.profiles.getDetailedForViewer(studentUserId, user);
  }
}
