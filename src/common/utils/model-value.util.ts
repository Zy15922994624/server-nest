import { HttpStatus } from '@nestjs/common';
import { Types } from 'mongoose';
import { ERROR_CODES } from '../constants/error-codes';
import { AppException } from '../exceptions/app.exception';

export function toObjectId(
  value: string | Types.ObjectId,
  invalidMessage = '参数 ID 不合法',
): Types.ObjectId {
  if (value instanceof Types.ObjectId) {
    return value;
  }

  if (!Types.ObjectId.isValid(value)) {
    throw new AppException(
      invalidMessage,
      ERROR_CODES.BAD_REQUEST,
      HttpStatus.BAD_REQUEST,
    );
  }

  return new Types.ObjectId(value);
}

export function readString(value: unknown): string | undefined {
  if (value instanceof Types.ObjectId) {
    return value.toString();
  }

  if (typeof value === 'string') {
    return value;
  }

  if (typeof value === 'number' || typeof value === 'boolean') {
    return String(value);
  }

  return undefined;
}

export function readObjectId(value: unknown): string {
  if (value instanceof Types.ObjectId) {
    return value.toString();
  }

  if (typeof value === 'string') {
    return value;
  }

  return '';
}

export function toISOString(value: unknown): string {
  if (value instanceof Date) {
    return value.toISOString();
  }

  if (typeof value !== 'string' && typeof value !== 'number') {
    return new Date(0).toISOString();
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return new Date(0).toISOString();
  }

  return date.toISOString();
}

export function toISOStringOrNull(value: unknown): string | null {
  if (!value) {
    return null;
  }

  return toISOString(value);
}
