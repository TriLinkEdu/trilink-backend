import {
  Controller,
  Post,
  Get,
  Body,
  Param,
  UseGuards,
  UseInterceptors,
  UploadedFile,
  ParseUUIDPipe,
  BadRequestException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { ApiBearerAuth, ApiConsumes, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole } from '../users/entities/user.entity';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { User } from '../users/entities/user.entity';
import { LearningMaterialsService } from './learning-materials.service';
import { CreateLearningMaterialDto } from './dto/create-learning-material.dto';
import { MaterialType } from './entities/learning-material.entity';

@ApiTags('Learning Materials')
@Controller('learning-materials')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth('JWT')
export class LearningMaterialsController {
  constructor(private readonly service: LearningMaterialsService) {}

  @Post()
  @Roles(UserRole.TEACHER, UserRole.ADMIN)
  @ApiOperation({ summary: 'Upload learning material (file or link)' })
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      limits: { fileSize: 10 * 1024 * 1024 },
    }),
  )
  async upload(
    @UploadedFile() file: Express.Multer.File,
    @Body() dto: CreateLearningMaterialDto,
    @CurrentUser() user: User,
  ) {
    if (dto.type !== MaterialType.LINK && !file) {
      throw new BadRequestException('File is required for PDF/TXT uploads');
    }
    return this.service.uploadMaterial(dto, user.id, file);
  }

  @Get('student/me')
  @Roles(UserRole.STUDENT)
  @ApiOperation({ summary: 'Fetch learning materials for enrolled classes' })
  fetchForStudent(@CurrentUser() user: User) {
    return this.service.fetchByStudentEnrollment(user.id);
  }

  @Get(':id')
  @Roles(UserRole.STUDENT, UserRole.TEACHER, UserRole.ADMIN)
  @ApiOperation({ summary: 'Get learning material by ID' })
  fetchById(@Param('id', ParseUUIDPipe) id: string) {
    return this.service.fetchById(id);
  }
}
