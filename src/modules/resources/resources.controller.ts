import { Controller, Get, Param, Query, UseGuards, NotFoundException, Inject } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole } from '../users/entities/user.entity';
import { TextbooksService } from '../textbooks/textbooks.service';
import { Subject } from '../school-structure/entities/subject.entity';
import { CourseResourceDto } from './dto/course-resource.dto';

@ApiTags('resources')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('resources')
export class ResourcesController {
  constructor(
    private readonly textbooksService: TextbooksService,
    @InjectRepository(Subject) private readonly subjectRepo: Repository<Subject>,
  ) {}

  @Get('me')
  @Roles(UserRole.STUDENT)
  @ApiOperation({ summary: 'Get course resources (textbooks) mapped for student consumption' })
  async getMyResources(@Query('subjectId') subjectIdFilter?: string): Promise<CourseResourceDto[]> {
    let subjectNameFilter: string | undefined = undefined;
    const allSubjects = await this.subjectRepo.find();
    
    if (subjectIdFilter) {
      const foundSub = allSubjects.find(s => s.id === subjectIdFilter);
      if (foundSub) {
        subjectNameFilter = foundSub.name;
      }
    }

    const textbooks = await this.textbooksService.findAll(subjectNameFilter ? { subject: subjectNameFilter } : undefined);
    
    return textbooks.map(t => {
      const mappedSubject = allSubjects.find(s => s.name.toLowerCase() === t.subject.toLowerCase());
      return {
        id: t.id,
        title: t.title,
        subjectId: mappedSubject ? mappedSubject.id : '00000000-0000-0000-0000-000000000000',
        subjectName: t.subject,
        topicId: undefined,
        type: 'pdf',
        difficulty: 'medium',
        description: t.description || 'Official textbook resource',
        url: t.accessUrl,
        fileSize: t.sizeBytes ? ((t.sizeBytes / 1048576).toFixed(1) + ' MB') : 'Unknown size',
        textbookId: t.id,
        textbookFileRecordId: t.fileRecordId,
        textbookCacheKey: t.cacheKey,
        uploadedAt: t.createdAt,
      };
    });
  }

  @Get(':id')
  @Roles(UserRole.STUDENT)
  @ApiOperation({ summary: 'Get a single course resource (textbook) by ID' })
  async getResourceById(@Param('id') id: string): Promise<CourseResourceDto> {
    const t = await this.textbooksService.findOne(id);
    if (!t) throw new NotFoundException('Resource not found');
    
    const mappedSubject = await this.subjectRepo.findOne({ where: { name: t.subject } });
    
    return {
      id: t.id,
      title: t.title,
      subjectId: mappedSubject ? mappedSubject.id : '00000000-0000-0000-0000-000000000000',
      subjectName: t.subject,
      type: 'pdf',
      difficulty: 'medium',
      description: t.description || 'Official textbook resource',
      url: t.accessUrl,
      fileSize: t.sizeBytes ? ((t.sizeBytes / 1048576).toFixed(1) + ' MB') : 'Unknown size',
      textbookId: t.id,
      textbookFileRecordId: t.fileRecordId,
      textbookCacheKey: t.cacheKey,
      uploadedAt: t.createdAt,
    };
  }
}

