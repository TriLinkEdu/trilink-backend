import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseIntPipe,
  ParseUUIDPipe,
  Post,
  Query,
  UploadedFiles,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileFieldsInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import {
  ApiBearerAuth,
  ApiBody,
  ApiConsumes,
  ApiOperation,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole } from '../users/entities/user.entity';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { User } from '../users/entities/user.entity';
import { TextbooksService } from './textbooks.service';
import { CreateTextbookDto } from './dto/create-textbook.dto';

@ApiTags('Textbooks')
@Controller('textbooks')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth('JWT')
export class TextbooksController {
  constructor(private readonly textbooks: TextbooksService) {}

  /* ── Upload (Admin / Teacher only) ─────────────────────── */

  @Post('upload')
  @Roles(UserRole.ADMIN, UserRole.TEACHER)
  @ApiOperation({ summary: 'Upload a textbook PDF (+ optional cover image)' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      required: ['file', 'title', 'subject', 'grade'],
      properties: {
        file:       { type: 'string', format: 'binary', description: 'PDF file (max 25 MB)' },
        cover:      { type: 'string', format: 'binary', description: 'Cover image (optional)' },
        title:      { type: 'string', example: 'Grade 9 Mathematics — New Curriculum' },
        subject:    { type: 'string', example: 'Mathematics' },
        grade:      { type: 'integer', example: 9 },
        description:{ type: 'string', example: 'Official Ethiopian Grade 9 student textbook' },
      },
    },
  })
  @UseInterceptors(
    FileFieldsInterceptor(
      [
        { name: 'file',  maxCount: 1 },
        { name: 'cover', maxCount: 1 },
      ],
      {
        storage: memoryStorage(),
        limits: { fileSize: 25 * 1024 * 1024 }, // 25 MB — enough for all 5 textbooks
      },
    ),
  )
  async upload(
    @UploadedFiles() files: { file?: Express.Multer.File[]; cover?: Express.Multer.File[] },
    @Body() dto: CreateTextbookDto,
    @CurrentUser() user: User,
  ) {
    const pdfFile   = files?.file?.[0];
    const coverFile = files?.cover?.[0];
    if (!pdfFile) {
      throw new BadRequestException('A PDF file is required. Use field name: file');
    }
    return this.textbooks.uploadTextbook(pdfFile, dto, user.id, coverFile);
  }

  /* ── List (all roles) ───────────────────────────────────── */

  @Get()
  @Roles(UserRole.ADMIN, UserRole.TEACHER, UserRole.STUDENT, UserRole.PARENT)
  @ApiOperation({ summary: 'List textbooks — filter by subject and/or grade' })
  @ApiQuery({ name: 'subject', required: false, example: 'Mathematics' })
  @ApiQuery({ name: 'grade',   required: false, type: Number, example: 9 })
  findAll(
    @Query('subject') subject?: string,
    @Query('grade') gradeStr?: string,
  ) {
    const parsedGrade = gradeStr ? parseInt(gradeStr, 10) : undefined;
    const grade = parsedGrade !== undefined && !isNaN(parsedGrade) ? parsedGrade : undefined;
    return this.textbooks.findAll({ subject, grade });
  }

  /* ── Single (all roles) ─────────────────────────────────── */

  @Get(':id')
  @Roles(UserRole.ADMIN, UserRole.TEACHER, UserRole.STUDENT, UserRole.PARENT)
  @ApiOperation({ summary: 'Get textbook detail with CDN download URL' })
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.textbooks.findOne(id);
  }

  /* ── Soft-delete (Admin only) ───────────────────────────── */

  @Delete(':id')
  @Roles(UserRole.ADMIN, UserRole.TEACHER)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Soft-delete a textbook (Admin only)' })
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.textbooks.remove(id);
  }
}
