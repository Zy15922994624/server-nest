import {
  BadRequestException,
  Controller,
  Post,
  Query,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiBody,
  ApiConsumes,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { UploadFileQueryDto } from './dto/upload-file-query.dto';
import type { StoredUploadFile } from './interfaces/upload-file.interface';
import {
  createStoredFilename,
  ensureDirectory,
  formatDateFolder,
  resolveUploadsDir,
} from './upload-storage.service';
import { UploadsService } from './uploads.service';
import path from 'path';

function createStorage() {
  return diskStorage({
    destination: (_req, _file, callback) => {
      const targetDir = path.join(resolveUploadsDir(), formatDateFolder());
      ensureDirectory(targetDir);
      callback(null, targetDir);
    },
    filename: (_req, file, callback) => {
      callback(null, createStoredFilename(file.originalname));
    },
  });
}

@ApiTags('upload')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('upload')
export class UploadsController {
  constructor(private readonly uploadsService: UploadsService) {}

  @Post('single')
  @ApiOperation({ summary: '上传单个文件' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      required: ['file'],
      properties: {
        file: {
          type: 'string',
          format: 'binary',
          description: '待上传文件',
        },
      },
    },
  })
  @UseInterceptors(
    FileInterceptor('file', {
      storage: createStorage(),
      limits: {
        fileSize: 50 * 1024 * 1024,
      },
    }),
  )
  uploadSingle(
    @UploadedFile() file: StoredUploadFile | undefined,
    @Query() query: UploadFileQueryDto,
  ) {
    if (!file) {
      throw new BadRequestException('请选择要上传的文件');
    }

    return this.uploadsService.toUploadFile(file, query.scene ?? 'attachment');
  }
}
