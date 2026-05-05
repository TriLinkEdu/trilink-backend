import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiResponse, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { GlobalSearchService } from './search.service';

@ApiTags('Search')
@Controller('search')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth('JWT')
export class SearchController {
  constructor(private readonly searchService: GlobalSearchService) {}

  @Get()
  @ApiOperation({
    summary: 'Global search across users, class offerings, and subjects',
    description:
      'Search across multiple entity types with a single query. ' +
      'Returns up to 5 results per entity type. ' +
      'Available to all authenticated users.',
  })
  @ApiQuery({
    name: 'q',
    required: true,
    description: 'Search query (minimum 2 characters)',
    example: 'math',
  })
  @ApiResponse({
    status: 200,
    description: 'Search results grouped by entity type',
    schema: {
      example: {
        users: [
          {
            entityType: 'user',
            id: 'uuid',
            title: 'John Doe',
            subtitle: 'teacher - john.doe@example.com',
            metadata: {
              role: 'teacher',
              email: 'john.doe@example.com',
              grade: null,
              section: null,
            },
          },
        ],
        classOfferings: [
          {
            entityType: 'classOffering',
            id: 'uuid',
            title: 'Mathematics',
            subtitle: 'Grade 9 - Section A',
            metadata: {
              subjectName: 'Mathematics',
              gradeName: 'Grade 9',
              sectionName: 'Section A',
            },
          },
        ],
        subjects: [
          {
            entityType: 'subject',
            id: 'uuid',
            title: 'Mathematics',
            subtitle: 'Code: MATH101',
            metadata: {
              code: 'MATH101',
            },
          },
        ],
        totalResults: 3,
      },
    },
  })
  @ApiResponse({
    status: 400,
    description: 'Invalid query (too short or missing)',
  })
  async search(@Query('q') query: string) {
    if (!query || query.trim().length < 2) {
      return {
        users: [],
        classOfferings: [],
        subjects: [],
        totalResults: 0,
      };
    }

    return this.searchService.search(query);
  }
}
