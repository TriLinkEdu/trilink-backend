import { Controller, Get, Param, ParseUUIDPipe, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole } from '../users/entities/user.entity';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { EnrollmentsService } from '../enrollments/enrollments.service';
import { TopicsService } from '../topics/topics.service';

@ApiTags('curriculum')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('curriculum')
export class CurriculumController {
  constructor(
    private readonly enrollmentsService: EnrollmentsService,
    private readonly topicsService: TopicsService,
  ) {}

  @Get('me/subjects')
  @Roles(UserRole.STUDENT)
  @ApiOperation({ summary: 'Get subjects for my enrolled classes (student)' })
  async getMySubjects(@CurrentUser() user: any) {
    const enrollments = await this.enrollmentsService.listMine(user.id);
    
    // Extract unique subjects
    const subjectMap = new Map<string, any>();
    for (const e of enrollments) {
      if (e.subject && !subjectMap.has(e.subject.id)) {
        subjectMap.set(e.subject.id, {
          id: e.subject.id,
          name: e.subject.name,
          code: e.subject.code || '',
          curriculumVersion: '2013EC', // Required by mobile app
        });
      }
    }
    
    return Array.from(subjectMap.values());
  }

  @Get('me/subjects/:subjectId/topics')
  @Roles(UserRole.STUDENT)
  @ApiOperation({ summary: 'Get topic hierarchy for a subject' })
  async getSubjectTopics(@Param('subjectId', ParseUUIDPipe) subjectId: string) {
    return this.topicsService.findBySubject(subjectId);
  }
}
