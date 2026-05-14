import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiBody,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { User, UserRole } from '../users/entities/user.entity';
import { HomeroomService } from './homeroom.service';
import { AssignHomeroomDto } from './dto/assign-homeroom.dto';

@ApiTags('Homeroom')
@Controller('homeroom')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth('JWT')
export class HomeroomController {
  constructor(private readonly svc: HomeroomService) {}

  @Post('assign')
  @Roles(UserRole.ADMIN)
  @ApiOperation({
    summary: 'Assign a homeroom teacher to a grade+section for an academic year',
    description:
      'Creates or updates the homeroom assignment. Only one homeroom teacher per class per year is allowed.',
  })
  @ApiBody({ type: AssignHomeroomDto })
  @ApiResponse({ status: 201, description: 'Assignment created or updated' })
  assign(@Body() dto: AssignHomeroomDto) {
    return this.svc.assign(dto);
  }

  @Get('my-class')
  @Roles(UserRole.TEACHER)
  @ApiOperation({
    summary: "Get homeroom teacher's class for the active academic year",
    description:
      'Returns the homeroom assignment and the list of students enrolled in that grade+section.',
  })
  @ApiResponse({
    status: 200,
    schema: {
      example: {
        assignment: {
          id: 'uuid',
          teacherId: 'uuid',
          academicYearId: 'uuid',
          gradeId: 'uuid',
          sectionId: 'uuid',
          createdAt: '2026-05-07T00:00:00.000Z',
          updatedAt: '2026-05-07T00:00:00.000Z',
        },
        students: [
          {
            id: 'uuid',
            firstName: 'Ali',
            lastName: 'Hassan',
            grade: 'Grade 9',
            section: 'A',
            profileImageFileId: null,
          },
        ],
      },
    },
  })
  @ApiResponse({ status: 404, description: 'No homeroom assignment found' })
  getMyClass(@CurrentUser() user: User) {
    return this.svc.getMyClass(user.id);
  }

  @Get('assignments')
  @Roles(UserRole.ADMIN)
  @ApiOperation({
    summary: 'List all homeroom assignments',
    description: 'Returns all homeroom assignments enriched with teacher name, grade name, section name.',
  })
  @ApiQuery({ name: 'academicYearId', required: false, description: 'Filter by academic year UUID' })
  @ApiResponse({ status: 200, description: 'List of homeroom assignments' })
  listAll(@Query('academicYearId') academicYearId?: string) {
    return this.svc.listAll(academicYearId);
  }

  @Delete('assign/:id')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Remove a homeroom assignment' })
  @ApiParam({ name: 'id', description: 'Homeroom assignment UUID' })
  @ApiResponse({ status: 200, description: 'Assignment removed' })
  @ApiResponse({ status: 404, description: 'Assignment not found' })
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.svc.remove(id);
  }
}
