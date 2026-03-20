import {
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  StreamableFile,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import type { Request } from 'express';
import { extname } from 'path';
import * as fs from 'fs';
import { createReadStream } from 'fs';
import { ApiBearerAuth, ApiBody, ApiConsumes, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole } from '../users/entities/user.entity';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { User } from '../users/entities/user.entity';
import { FilesService } from './files.service';
import { randomUUID } from 'crypto';

@ApiTags('Files')
@Controller('files')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN, UserRole.TEACHER, UserRole.STUDENT, UserRole.PARENT)
@ApiBearerAuth('JWT')
export class FilesController {
  constructor(private readonly files: FilesService) {}

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
      storage: diskStorage({
        destination: (_req: Request, _file: Express.Multer.File, cb: (e: Error | null, p: string) => void) => {
          const dir = 'uploads';
          if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
          cb(null, dir);
        },
        filename: (_req: Request, file: Express.Multer.File, cb: (e: Error | null, p: string) => void) =>
          cb(null, `${randomUUID()}${extname(file.originalname)}`),
      }),
      limits: { fileSize: 10 * 1024 * 1024 },
    }),
  )
  async upload(@UploadedFile() file: Express.Multer.File, @CurrentUser() user: User) {
    return this.files.saveFromDisk(file, user.id);
  }

  @Get(':id')
  @ApiOperation({ summary: 'File metadata' })
  meta(@Param('id', ParseUUIDPipe) id: string) {
    return this.files.get(id);
  }

  @Get(':id/download')
  @ApiOperation({ summary: 'Download file content (authenticated)' })
  async download(@Param('id', ParseUUIDPipe) id: string) {
    const rec = await this.files.getOrThrow(id);
    const stream = createReadStream(rec.path);
    return new StreamableFile(stream, {
      type: rec.mime,
      disposition: `inline; filename="${encodeURIComponent(rec.filename)}"`,
    });
  }
}
