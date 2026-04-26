import { Body, Controller, Get, NotFoundException, Param, ParseUUIDPipe, Patch, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiPropertyOptional, ApiTags } from '@nestjs/swagger';
import { IsOptional, IsString, IsUUID } from 'class-validator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { User, UserRole } from './entities/user.entity';
import { UsersService } from './users.service';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

class PatchUserDto {
  @ApiPropertyOptional() @IsOptional() @IsString() firstName?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() lastName?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() phone?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() grade?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() section?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() subject?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() department?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() homeroomClass?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() experience?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() country?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() cityState?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() postalCode?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() officeRoom?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() childName?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() relationship?: string;
  @ApiPropertyOptional() @IsOptional() @IsUUID() profileImageFileId?: string;
}

@ApiTags('Users')
@Controller('users')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth('JWT')
export class UsersController {
  constructor(private readonly users: UsersService) {}

  @Get()
  @Roles(UserRole.ADMIN, UserRole.TEACHER)
  @ApiOperation({ summary: 'Directory (admin / teacher)' })
  list(@Query('role') role?: UserRole, @Query('q') q?: string) {
    return this.users.listUsers({ role, q });
  }

  @Get('search')
  @ApiOperation({ summary: 'Search users to chat with (available to all users)' })
  searchUsers(@Query('role') role?: UserRole, @Query('q') q?: string) {
    return this.users.listUsers({ role, q });
  }

  @Get(':id')
  @Roles(UserRole.ADMIN, UserRole.TEACHER)
  async one(@Param('id', ParseUUIDPipe) id: string) {
    const u = await this.users.findById(id);
    if (!u) throw new NotFoundException('User not found');
    return this.users.toPublic(u);
  }

  @Patch('me')
  @ApiOperation({ summary: 'Update own profile' })
  async patchMe(@CurrentUser() user: User, @Body() body: PatchUserDto) {
    const updated = await this.users.patchUser(user.id, body);
    return this.users.toPublicWithImage(updated);
  }

  @Patch(':id')
  @Roles(UserRole.ADMIN)
  patch(@Param('id', ParseUUIDPipe) id: string, @Body() body: PatchUserDto) {
    return this.users.patchUser(id, body);
  }
}
