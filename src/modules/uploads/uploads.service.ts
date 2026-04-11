import { HttpStatus, Injectable } from '@nestjs/common';
import { ERROR_CODES } from '../../common/constants/error-codes';
import { AppException } from '../../common/exceptions/app.exception';
import type {
  StoredUploadFile,
  UploadFileDto,
} from './interfaces/upload-file.interface';
import {
  normalizeUploadedFilename,
  UploadStorageService,
} from './upload-storage.service';

type UploadScene = 'image' | 'attachment';

interface SceneRule {
  maxSize: number;
  allowedMimeTypes: string[];
}

const IMAGE_RULE: SceneRule = {
  maxSize: 5 * 1024 * 1024,
  allowedMimeTypes: [
    'image/jpeg',
    'image/jpg',
    'image/png',
    'image/gif',
    'image/webp',
  ],
};

const ATTACHMENT_RULE: SceneRule = {
  maxSize: 50 * 1024 * 1024,
  allowedMimeTypes: [
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.ms-powerpoint',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    'image/jpeg',
    'image/jpg',
    'image/png',
    'image/gif',
    'image/webp',
    'video/mp4',
    'video/avi',
    'video/x-msvideo',
    'video/quicktime',
    'video/x-ms-wmv',
    'video/webm',
    'video/x-matroska',
    'application/zip',
    'application/x-compressed',
    'application/x-zip',
    'application/x-zip-compressed',
    'application/x-rar-compressed',
    'application/x-7z-compressed',
    'application/gzip',
    'application/x-gzip',
    'application/x-bzip2',
    'application/x-xz',
    'application/x-tar',
    'text/plain',
    'text/markdown',
    'application/json',
  ],
};

@Injectable()
export class UploadsService {
  constructor(private readonly uploadStorageService: UploadStorageService) {}

  private readonly sceneRules: Record<UploadScene, SceneRule> = {
    image: IMAGE_RULE,
    attachment: ATTACHMENT_RULE,
  };

  async toUploadFile(
    file: StoredUploadFile | undefined,
    scene: UploadScene,
  ): Promise<UploadFileDto> {
    if (!file) {
      throw new AppException(
        '请选择要上传的文件',
        ERROR_CODES.BAD_REQUEST,
        HttpStatus.BAD_REQUEST,
      );
    }

    try {
      this.validateFile(file, scene);

      const key = this.uploadStorageService.toStorageKey(file.path);

      return {
        key,
        url: `/${key}`,
        originalName: normalizeUploadedFilename(file.originalname),
        size: file.size,
        mimeType: file.mimetype,
      };
    } catch (error) {
      await this.uploadStorageService.removeStoredFileByPath(file.path);
      throw error;
    }
  }

  private validateFile(file: StoredUploadFile, scene: UploadScene): void {
    const rule = this.sceneRules[scene];
    if (file.size > rule.maxSize) {
      throw new AppException(
        scene === 'image' ? '图片大小不能超过 5MB' : '附件大小不能超过 50MB',
        ERROR_CODES.BAD_REQUEST,
        HttpStatus.BAD_REQUEST,
      );
    }

    if (!rule.allowedMimeTypes.includes(file.mimetype)) {
      throw new AppException(
        scene === 'image'
          ? '仅支持 JPG、PNG、GIF、WEBP 图片'
          : `不支持的文件类型：${file.mimetype}`,
        ERROR_CODES.BAD_REQUEST,
        HttpStatus.BAD_REQUEST,
      );
    }
  }
}
