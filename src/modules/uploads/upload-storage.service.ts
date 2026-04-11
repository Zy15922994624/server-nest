import { HttpStatus, Injectable } from '@nestjs/common';
import fs from 'fs';
import path from 'path';
import { ERROR_CODES } from '../../common/constants/error-codes';
import { AppException } from '../../common/exceptions/app.exception';

export function resolveUploadsDir(): string {
  return process.env.UPLOADS_DIR?.trim() || path.join(process.cwd(), 'uploads');
}

export function ensureDirectory(targetPath: string): string {
  if (!fs.existsSync(targetPath)) {
    fs.mkdirSync(targetPath, { recursive: true });
  }

  return targetPath;
}

export function formatDateFolder(date = new Date()): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}${month}${day}`;
}

export function createStoredFilename(originalName: string): string {
  const timestamp = Date.now();
  const randomValue = Math.round(Math.random() * 1e9);
  const extension = path.extname(originalName).toLowerCase();
  return `${timestamp}-${randomValue}${extension}`;
}

const CJK_PATTERN = /[\u3400-\u9fff]/;
const MOJIBAKE_PATTERN = /[ÃÂãåæçèéêëìíîïðñòóôõöøùúûüýþ]/;

export function normalizeUploadedFilename(originalName: string): string {
  const trimmed = originalName.trim();
  if (!trimmed) {
    return trimmed;
  }

  if (CJK_PATTERN.test(trimmed)) {
    return trimmed;
  }

  if (!MOJIBAKE_PATTERN.test(trimmed)) {
    return trimmed;
  }

  const decoded = Buffer.from(trimmed, 'latin1').toString('utf8').trim();
  if (!decoded || decoded.includes('�') || decoded.includes('\u0000')) {
    return trimmed;
  }

  const originalSuspiciousCount = (trimmed.match(MOJIBAKE_PATTERN) || []).length;
  const decodedSuspiciousCount = (decoded.match(MOJIBAKE_PATTERN) || []).length;

  if (CJK_PATTERN.test(decoded) || decodedSuspiciousCount < originalSuspiciousCount) {
    return decoded;
  }

  return trimmed;
}

@Injectable()
export class UploadStorageService {
  getUploadsDir(): string {
    return path.resolve(resolveUploadsDir());
  }

  createDatedUploadDirectory(date = new Date()): string {
    const targetDir = path.join(this.getUploadsDir(), formatDateFolder(date));
    return ensureDirectory(targetDir);
  }

  toStorageKey(filePath: string): string {
    const uploadsDir = this.getUploadsDir();
    const normalizedFilePath = path.resolve(filePath);
    const relativePath = path.relative(uploadsDir, normalizedFilePath);

    if (
      !relativePath ||
      path.isAbsolute(relativePath) ||
      relativePath.startsWith('..')
    ) {
      throw new AppException(
        '上传文件路径异常',
        ERROR_CODES.BAD_REQUEST,
        HttpStatus.BAD_REQUEST,
      );
    }

    return path.posix.join(
      'uploads',
      relativePath.split(path.sep).join(path.posix.sep),
    );
  }

  resolveStoredFilePath(fileKey: string): string {
    const normalizedKey = fileKey.trim();
    const relativePath = normalizedKey.startsWith('uploads/')
      ? normalizedKey.slice('uploads/'.length)
      : normalizedKey;
    const uploadsDir = this.getUploadsDir();
    const targetPath = path.resolve(uploadsDir, relativePath);

    if (!this.isWithinDirectory(uploadsDir, targetPath)) {
      throw new AppException(
        '资源文件路径异常',
        ERROR_CODES.BAD_REQUEST,
        HttpStatus.BAD_REQUEST,
      );
    }

    return targetPath;
  }

  async removeStoredFileByPath(filePath: string): Promise<void> {
    try {
      await fs.promises.unlink(filePath);
    } catch {
      return;
    }
  }

  async removeStoredFileByKey(fileKey: string): Promise<void> {
    try {
      const targetPath = this.resolveStoredFilePath(fileKey);
      await this.removeStoredFileByPath(targetPath);
    } catch {
      return;
    }
  }

  private isWithinDirectory(rootPath: string, targetPath: string): boolean {
    const normalizedRoot = path.resolve(rootPath);
    const normalizedTarget = path.resolve(targetPath);

    return (
      normalizedTarget === normalizedRoot ||
      normalizedTarget.startsWith(`${normalizedRoot}${path.sep}`)
    );
  }
}
