import { Body, Controller, Get, NotFoundException, Param, ParseUUIDPipe, Patch, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiPropertyOptional, ApiQuery, ApiTags } from '@nestjs/swagger';
import { IsOptional, IsString, IsUUID } from 'class-validator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { User, UserRole } from './entities/user.entity';
import { UsersService } from './users.service';
import { UserFilterService } from './services/user-filter.service';
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
  @ApiPropertyOptional() @IsOptional() @IsString() password?: string;
}

@ApiTags('Users')
@Controller('users')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth('JWT')
export class UsersController {
  constructor(
    private readonly users: UsersService,
    private readonly filterService: UserFilterService,
  ) {}

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

  @Get('students')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Filter students by grade, section, academic year' })
  @ApiQuery({ name: 'grade', required: false })
  @ApiQuery({ name: 'section', required: false })
  @ApiQuery({ name: 'academicYearId', required: false })
  @ApiQuery({ name: 'q', required: false, description: 'Search term' })
  async filterStudents(
    @Query('grade') grade?: string,
    @Query('section') section?: string,
    @Query('academicYearId') academicYearId?: string,
    @Query('q') searchTerm?: string,
  ) {
    const students = await this.filterService.filterStudents({
      grade,
      section,
      academicYearId,
      searchTerm,
    });
    return students.map((u) => this.users.toPublic(u));
  }

  @Get('teachers')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Filter teachers by subject, department' })
  @ApiQuery({ name: 'subject', required: false })
  @ApiQuery({ name: 'department', required: false })
  @ApiQuery({ name: 'q', required: false, description: 'Search term' })
  async filterTeachers(
    @Query('subject') subject?: string,
    @Query('department') department?: string,
    @Query('q') searchTerm?: string,
  ) {
    const teachers = await this.filterService.filterTeachers({
      subject,
      department,
      searchTerm,
    });
    return teachers.map((u) => this.users.toPublic(u));
  }

  @Get('parents')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Filter parents by linked student grade/section' })
  @ApiQuery({ name: 'studentGrade', required: false })
  @ApiQuery({ name: 'studentSection', required: false })
  @ApiQuery({ name: 'q', required: false, description: 'Search term' })
  async filterParents(
    @Query('studentGrade') grade?: string,
    @Query('studentSection') section?: string,
    @Query('q') searchTerm?: string,
  ) {
    const parents = await this.filterService.filterParents({
      grade,
      section,
      searchTerm,
    });
    return parents.map((u) => this.users.toPublic(u));
  }

  @Get(':id')
  @Roles(UserRole.ADMIN, UserRole.TEACHER)
  async one(@Param('id', ParseUUIDPipe) id: string) {
    const u = await this.users.findById(id);
    if (!u) throw new NotFoundException('User not found');
    return this.users.toPublic(u);
  }

  @Get(':userId/profile')
  @ApiOperation({ summary: 'Get user profile details (for chat modal)' })
  async getUserProfile(@Param('userId', ParseUUIDPipe) userId: string) {
    const u = await this.users.findById(userId);
    if (!u) throw new NotFoundException('User not found');
    
    return {
      id: u.id,
      firstName: u.firstName,
      lastName: u.lastName,
      email: u.email,
      role: u.role,
      grade: u.grade ?? null,
      section: u.section ?? null,
      subject: u.subject ?? null,
      department: u.department ?? null,
      profileImageFileId: u.profileImageFileId ?? null,
    };
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
