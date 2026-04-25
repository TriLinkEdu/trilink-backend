import { Body, Controller, Get, Param, ParseUUIDPipe, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiProperty, ApiTags } from '@nestjs/swagger';
import { IsString, MinLength } from 'class-validator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { User, UserRole } from '../users/entities/user.entity';
import { AssignmentsService } from './assignments.service';

class SubmitAssignmentDto {
  @ApiProperty({ example: 'My solution and explanation...' })
  @IsString()
  @MinLength(1)
  content: string;
}

@ApiTags('Assignments')
@Controller('assignments')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth('JWT')
export class AssignmentsController {
  constructor(private readonly assignments: AssignmentsService) {}

  @Get('me')
  @Roles(UserRole.STUDENT)
  @ApiOperation({ summary: 'List assignments for current student' })
  listMine(@CurrentUser() user: User) {
    return this.assignments.listMine(user);
  }

  @Get(':id')
  @Roles(UserRole.STUDENT)
  @ApiOperation({ summary: 'Get assignment detail for current student' })
  getMineById(@CurrentUser() user: User, @Param('id', ParseUUIDPipe) id: string) {
    return this.assignments.getMineById(user, id);
  }

  @Post(':id/submissions')
  @Roles(UserRole.STUDENT)
  @ApiOperation({ summary: 'Submit assignment content for current student' })
  submit(@CurrentUser() user: User, @Param('id', ParseUUIDPipe) id: string, @Body() dto: SubmitAssignmentDto) {
    return this.assignments.submitMine(user, id, dto.content);
  }
}
