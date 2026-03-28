import { Body, Controller, Get, Param, ParseUUIDPipe, Post, Put, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { ApiProperty } from '@nestjs/swagger';
import { IsArray, IsString, IsUUID, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole } from '../users/entities/user.entity';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { User } from '../users/entities/user.entity';
import { AttendanceService } from './attendance.service';

class MarkRow {
  @ApiProperty() @IsUUID() studentId: string;
  @ApiProperty({ example: 'present' }) @IsString() status: string;
}
class BulkMarksDto {
  @ApiProperty({ type: [MarkRow] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => MarkRow)
  marks: MarkRow[];
}

@ApiTags('Attendance')
@Controller()
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth('JWT')
export class AttendanceController {
  constructor(private readonly svc: AttendanceService) {}

  @Post('attendance-sessions')
  @Roles(UserRole.ADMIN, UserRole.TEACHER)
  @ApiOperation({ summary: 'Create attendance session' })
  createSession(
    @Body() body: { classOfferingId: string; date: string },
    @CurrentUser() user: User,
  ) {
    return this.svc.createSession({ ...body, takenById: user.id });
  }

  @Get('attendance-sessions')
  @Roles(UserRole.ADMIN, UserRole.TEACHER)
  listSessions(@Query('classOfferingId') classOfferingId: string) {
    return this.svc.listSessions(classOfferingId);
  }

  @Put('attendance-sessions/:id/marks')
  @Roles(UserRole.ADMIN, UserRole.TEACHER)
  putMarks(@Param('id', ParseUUIDPipe) id: string, @Body() dto: BulkMarksDto) {
    return this.svc.putMarks(id, dto.marks);
  }

  @Get('attendance-sessions/:id/marks')
  @Roles(UserRole.ADMIN, UserRole.TEACHER)
  getMarks(@Param('id', ParseUUIDPipe) id: string) {
    return this.svc.getMarks(id);
  }

  @Get('reports/attendance/student/:studentId')
  @Roles(UserRole.ADMIN, UserRole.TEACHER, UserRole.STUDENT, UserRole.PARENT)
  @ApiOperation({ summary: 'Student attendance report (self/parent restricted in production)' })
  repStudent(@Param('studentId', ParseUUIDPipe) studentId: string) {
    return this.svc.reportStudent(studentId);
  }

  @Get('reports/attendance/class/:classOfferingId')
  @Roles(UserRole.ADMIN, UserRole.TEACHER)
  repClass(@Param('classOfferingId', ParseUUIDPipe) classOfferingId: string) {
    return this.svc.reportClass(classOfferingId);
  }
}
