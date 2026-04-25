import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  ParseUUIDPipe,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole } from '../users/entities/user.entity';
import { TopicsService } from './topics.service';
import { CreateTopicDto, UpdateTopicDto } from './dto/topic.dto';

@ApiTags('Topics')
@Controller('topics')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth('JWT')
export class TopicsController {
  constructor(private readonly service: TopicsService) {}

  @Post()
  @Roles(UserRole.TEACHER, UserRole.ADMIN)
  @ApiOperation({ summary: 'Create a topic under a subject (Teacher/Admin)' })
  create(@Body() dto: CreateTopicDto) {
    return this.service.create(dto);
  }

  @Get()
  @Roles(UserRole.TEACHER, UserRole.STUDENT, UserRole.ADMIN)
  @ApiOperation({ summary: 'List topics by subject' })
  findBySubject(@Query('subjectId', ParseUUIDPipe) subjectId: string) {
    return this.service.findBySubject(subjectId);
  }

  @Get(':id')
  @Roles(UserRole.TEACHER, UserRole.STUDENT, UserRole.ADMIN)
  @ApiOperation({ summary: 'Get topic by ID' })
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.service.findOne(id);
  }

  @Put(':id')
  @Roles(UserRole.TEACHER, UserRole.ADMIN)
  @ApiOperation({ summary: 'Update a topic (Teacher/Admin)' })
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateTopicDto,
  ) {
    return this.service.update(id, dto);
  }

  @Delete(':id')
  @Roles(UserRole.TEACHER, UserRole.ADMIN)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete a topic (Teacher/Admin)' })
  async remove(@Param('id', ParseUUIDPipe) id: string) {
    await this.service.remove(id);
  }
}
