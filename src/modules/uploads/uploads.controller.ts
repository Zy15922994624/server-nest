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
import fs from 'fs';
import path from 'path';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { UploadFileQueryDto } from './dto/upload-file-query.dto';
import type { StoredUploadFile } from './interfaces/upload-file.interface';
import { UploadsService } from './uploads.service';

function resolveUploadsDir() {
  return process.env.UPLOADS_DIR?.trim() || path.join(process.cwd(), 'uploads');
}

function ensureDirectory(targetPath: string) {
  if (!fs.existsSync(targetPath)) {
    fs.mkdirSync(targetPath, { recursive: true });
  }
}

function formatDateFolder() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}${month}${day}`;
}

function createStorage() {
  return diskStorage({
    destination: (_req, _file, callback) => {
      const targetDir = path.join(resolveUploadsDir(), formatDateFolder());
      ensureDirectory(targetDir);
      callback(null, targetDir);
    },
    filename: (_req, file, callback) => {
      const timestamp = Date.now();
      const randomValue = Math.round(Math.random() * 1e9);
      const extension = path.extname(file.originalname).toLowerCase();
      callback(null, `${timestamp}-${randomValue}${extension}`);
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
