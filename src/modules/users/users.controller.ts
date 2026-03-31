import { Body, Controller, Get, NotFoundException, Param, ParseUUIDPipe, Patch, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiPropertyOptional, ApiTags } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole } from './entities/user.entity';
import { UsersService } from './users.service';

class PatchUserDto {
  @ApiPropertyOptional() @IsOptional() @IsString() firstName?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() lastName?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() phone?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() grade?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() section?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() subject?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() department?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() childName?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() relationship?: string;
}

@ApiTags('Users')
@Controller('users')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN)
@ApiBearerAuth('JWT')
export class UsersController {
  constructor(private readonly users: UsersService) {}

  @Get()
  @ApiOperation({ summary: 'Directory (admin)' })
  list(@Query('role') role?: UserRole, @Query('q') q?: string) {
    return this.users.listUsers({ role, q });
  }

  @Get(':id')
  async one(@Param('id', ParseUUIDPipe) id: string) {
    const u = await this.users.findById(id);
    if (!u) throw new NotFoundException('User not found');
    return this.users.toPublic(u);
  }

  @Patch(':id')
  patch(@Param('id', ParseUUIDPipe) id: string, @Body() body: PatchUserDto) {
    return this.users.patchUser(id, body);
  }
}
