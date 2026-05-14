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
import {
  ApiBearerAuth,
  ApiOperation,
  ApiQuery,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole } from '../users/entities/user.entity';
import { AcademicYearsService } from './academic-years.service';
import { CreateAcademicYearDto } from './dto/create-academic-year.dto';
import { UpdateAcademicYearDto } from './dto/update-academic-year.dto';
import { CreateTermDto } from './dto/create-term.dto';
import { ErrorResponseDto } from '../../common/dto/error-response.dto';

@ApiTags('Academic calendar')
@Controller('academic-years')
export class AcademicYearsController {
  constructor(private readonly svc: AcademicYearsService) {}

  @Get('active')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('JWT')
  @ApiOperation({ summary: 'Get the currently active academic year' })
  @ApiResponse({ status: 404, description: 'No active year' })
  async active() {
    const years = await this.svc.findAll();
    const a = years.find((y) => y.isActive && !y.isArchived);
    if (!a) return { data: null };
    return { data: a };
  }

  @Get('current')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('JWT')
  @ApiOperation({ summary: 'Get the current academic year (alias for active)' })
  @ApiResponse({ status: 404, description: 'No current year' })
  async current() {
    return this.active();
  }

  @Get()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @ApiBearerAuth('JWT')
  @ApiOperation({ summary: 'List all academic years (admin)' })
  async list() {
    return this.svc.findAll();
  }

  @Get(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @ApiBearerAuth('JWT')
  @ApiOperation({ summary: 'Get academic year with terms' })
  async one(@Param('id', ParseUUIDPipe) id: string) {
    return this.svc.findOne(id);
  }

  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @ApiBearerAuth('JWT')
  @ApiOperation({ summary: 'Create academic year' })
  @ApiResponse({ status: 201, description: 'Created' })
  @ApiResponse({ status: 400, type: ErrorResponseDto })
  async create(@Body() dto: CreateAcademicYearDto) {
    return this.svc.create(dto);
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @ApiBearerAuth('JWT')
  @ApiOperation({ summary: 'Update academic year' })
  async patch(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateAcademicYearDto) {
    return this.svc.update(id, dto);
  }

  @Post(':id/activate')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @ApiBearerAuth('JWT')
  @ApiOperation({ summary: 'Set this year as the only active year' })
  async activate(@Param('id', ParseUUIDPipe) id: string) {
    return this.svc.activate(id);
  }

  @Post(':id/close')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @ApiBearerAuth('JWT')
  @ApiOperation({ summary: 'Archive and deactivate a year' })
  async close(@Param('id', ParseUUIDPipe) id: string) {
    return this.svc.closeYear(id);
  }

  @Post(':id/rollover')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @ApiBearerAuth('JWT')
  @ApiOperation({ summary: 'Create new active year and copy class offerings from source' })
  @ApiQuery({ name: 'dryRun', required: false, example: false })
  @ApiQuery({ name: 'newLabel', required: true, example: '2026/2027' })
  async rollover(
    @Param('id', ParseUUIDPipe) id: string,
    @Query('newLabel') newLabel: string,
    @Query('dryRun') dryRun?: string,
  ) {
    if (!newLabel) throw new BadRequestException('newLabel query required');
    return this.svc.rollover(id, newLabel, dryRun === 'true');
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @ApiBearerAuth('JWT')
  @ApiOperation({ summary: 'Delete academic year' })
  async remove(@Param('id', ParseUUIDPipe) id: string) {
    await this.svc.remove(id);
    return { ok: true };
  }

  @Get(':yearId/terms')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.TEACHER, UserRole.STUDENT, UserRole.PARENT)
  @ApiBearerAuth('JWT')
  @ApiOperation({ summary: 'List terms for a year' })
  async terms(@Param('yearId', ParseUUIDPipe) yearId: string) {
    return this.svc.listTerms(yearId);
  }

  @Post(':yearId/terms')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @ApiBearerAuth('JWT')
  @ApiOperation({ summary: 'Add term to year' })
  async addTerm(@Param('yearId', ParseUUIDPipe) yearId: string, @Body() dto: CreateTermDto) {
    return this.svc.addTerm(yearId, dto);
  }

  @Delete('terms/:termId')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @ApiBearerAuth('JWT')
  @ApiOperation({ summary: 'Delete a term' })
  async delTerm(@Param('termId', ParseUUIDPipe) termId: string) {
    await this.svc.removeTerm(termId);
    return { ok: true };
  }
}
