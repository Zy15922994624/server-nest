import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { Response } from 'express';
import { AppException } from '../exceptions/app.exception';
import { ERROR_CODES } from '../constants/error-codes';

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();

    if (exception instanceof AppException) {
      response.status(exception.getStatus()).json({
        code: exception.code,
        message: exception.message,
        data: null,
      });
      return;
    }

    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const exceptionResponse = exception.getResponse();
      const normalized = this.normalizeHttpException(exceptionResponse, status);

      response.status(status).json({
        code: normalized.code,
        message: normalized.message,
        data: null,
      });
      return;
    }

    response.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
      code: ERROR_CODES.INTERNAL_SERVER_ERROR,
      message: '服务器内部错误',
      data: null,
    });
  }

  private normalizeHttpException(
    exceptionResponse: string | object,
    status: number,
  ): { code: number; message: string } {
    if (typeof exceptionResponse === 'string') {
      return {
        code: this.mapHttpStatusToCode(status),
        message: exceptionResponse,
      };
    }

    const payload = exceptionResponse as {
      message?: string | string[];
      code?: number;
      error?: string;
    };

    const message = Array.isArray(payload.message)
      ? payload.message.join('；')
      : (payload.message ?? payload.error ?? '请求失败');

    return {
      code: payload.code ?? this.mapHttpStatusToCode(status),
      message,
    };
  }

  private mapHttpStatusToCode(status: number) {
    const normalizedStatus = status as HttpStatus;

    switch (normalizedStatus) {
      case HttpStatus.BAD_REQUEST:
        return ERROR_CODES.BAD_REQUEST;
      case HttpStatus.UNAUTHORIZED:
        return ERROR_CODES.UNAUTHORIZED;
      case HttpStatus.FORBIDDEN:
        return ERROR_CODES.FORBIDDEN;
      case HttpStatus.NOT_FOUND:
        return ERROR_CODES.NOT_FOUND;
      default:
        return ERROR_CODES.INTERNAL_SERVER_ERROR;
    }
  }
}
