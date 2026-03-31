import { Body, Controller, Get, Patch, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { ApiProperty } from '@nestjs/swagger';
import { IsString } from 'class-validator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole } from '../users/entities/user.entity';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { User } from '../users/entities/user.entity';
import { SettingsService } from './settings.service';

class JsonDto {
  @ApiProperty({ example: '{"theme":"dark"}' }) @IsString() settingsJson: string;
}

@ApiTags('Settings')
@Controller()
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth('JWT')
export class SettingsController {
  constructor(private readonly svc: SettingsService) {}

  @Get('me/settings')
  @Roles(UserRole.ADMIN, UserRole.TEACHER, UserRole.STUDENT, UserRole.PARENT)
  @ApiOperation({ summary: 'Current user settings JSON blob' })
  me(@CurrentUser() user: User) {
    return this.svc.getUser(user.id);
  }

  @Patch('me/settings')
  @Roles(UserRole.ADMIN, UserRole.TEACHER, UserRole.STUDENT, UserRole.PARENT)
  patchMe(@CurrentUser() user: User, @Body() dto: JsonDto) {
    return this.svc.patchUser(user.id, dto.settingsJson);
  }

  @Get('school/settings')
  @Roles(UserRole.ADMIN, UserRole.TEACHER, UserRole.STUDENT, UserRole.PARENT)
  schoolGet() {
    return this.svc.getSchool();
  }

  @Patch('school/settings')
  @Roles(UserRole.ADMIN)
  schoolPatch(@Body() dto: JsonDto) {
    return this.svc.patchSchool(dto.settingsJson);
  }
}
