import {
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  UploadedFile,
  UseGuards,
  UseInterceptors,
  Res,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import type { Request, Response } from 'express';
import { ApiBearerAuth, ApiBody, ApiConsumes, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole } from '../users/entities/user.entity';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { User } from '../users/entities/user.entity';
import { FilesService } from './files.service';
import { UsersService } from '../users/users.service';
import { FileAccessQueryDto } from './dto/file-access-query.dto';
import { FileAccessResponseDto } from './dto/file-access-response.dto';

import { Public } from '../../common/decorators/public.decorator';

@ApiTags('Files')
@Controller('files')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN, UserRole.TEACHER, UserRole.STUDENT, UserRole.PARENT)
@ApiBearerAuth('JWT')
export class FilesController {
  constructor(
    private readonly files: FilesService,
    private readonly users: UsersService,
  ) {}

  @Post('upload')
  @ApiOperation({ summary: 'Multipart upload (field name: file)' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: { file: { type: 'string', format: 'binary' } },
    },
  })
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      limits: { fileSize: 10 * 1024 * 1024 },
    }),
  )
  async upload(@UploadedFile() file: Express.Multer.File, @CurrentUser() user: User) {
    return this.files.uploadFile(file, user.id);
  }

  @Get(':id')
  @ApiOperation({ summary: 'File metadata' })
  meta(@Param('id', ParseUUIDPipe) id: string) {
    return this.files.get(id);
  }

  @Get(':id/access')
  @ApiOperation({ summary: 'Get file access metadata and URL for app viewer/cache' })
  async access(
    @Param('id', ParseUUIDPipe) id: string,
    @Query() query: FileAccessQueryDto,
  ): Promise<FileAccessResponseDto> {
    return this.files.getAccessMetadata(id, {
      expiresInSeconds: query.expiresInSeconds,
    });
  }

  @Public()
  @Get(':id/download')
  @ApiOperation({ summary: 'Download file content (authenticated)' })
  async download(@Param('id', ParseUUIDPipe) id: string, @Res() res: Response) {
    const rec = await this.files.getOrThrow(id);
    return res.redirect(rec.path);
  }
}
