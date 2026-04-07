import { HttpStatus, Injectable } from '@nestjs/common';
import { ERROR_CODES } from '../../common/constants/error-codes';
import { AppException } from '../../common/exceptions/app.exception';
import { CreateQuestionBankDto } from './dto/create-question-bank.dto';
import { UpdateQuestionBankDto } from './dto/update-question-bank.dto';
import type { SanitizedQuestionPayload } from './question-bank.types';
import type { QuestionType } from './schemas/question-bank.schema';

@Injectable()
export class QuestionBankValidatorService {
  sanitizePayload(
    payload: CreateQuestionBankDto | UpdateQuestionBankDto,
    isPartial = false,
  ): SanitizedQuestionPayload {
    const next: SanitizedQuestionPayload = {};

    const nextType = payload.type;
    if (!isPartial || nextType !== undefined) {
      next.type = nextType as QuestionType;
    }

    if (typeof payload.title === 'string') {
      const title = payload.title.trim();
      if (!title) {
        throw new AppException(
          '题干不能为空',
          ERROR_CODES.BAD_REQUEST,
          HttpStatus.BAD_REQUEST,
        );
      }
      next.title = title;
    }

    if (!isPartial && next.title === undefined) {
      throw new AppException(
        '题干不能为空',
        ERROR_CODES.BAD_REQUEST,
        HttpStatus.BAD_REQUEST,
      );
    }

    if (typeof payload.description === 'string') {
      next.description = payload.description.trim();
    } else if (!isPartial && payload.description === undefined) {
      next.description = '';
    }

    if (typeof payload.analysis === 'string') {
      next.analysis = payload.analysis.trim();
    } else if (!isPartial && payload.analysis === undefined) {
      next.analysis = '';
    }

    if (payload.score !== undefined) {
      next.score = payload.score;
    }

    if (!isPartial && next.score === undefined) {
      throw new AppException(
        '分值不能为空',
        ERROR_CODES.BAD_REQUEST,
        HttpStatus.BAD_REQUEST,
      );
    }

    if (payload.answer !== undefined) {
      next.answer = payload.answer;
    }

    if (!isPartial && next.answer === undefined) {
      throw new AppException(
        '参考答案不能为空',
        ERROR_CODES.BAD_REQUEST,
        HttpStatus.BAD_REQUEST,
      );
    }

    if (payload.options !== undefined) {
      next.options = payload.options.map((item) => ({
        key: item.key.trim(),
        label: item.label.trim(),
      }));
    } else if (!isPartial && nextType && !this.isChoiceType(nextType)) {
      next.options = [];
    }

    const validationType = next.type ?? payload.type;
    const validationOptions =
      next.options ??
      payload.options?.map((item) => ({
        key: item.key.trim(),
        label: item.label.trim(),
      }));
    const validationAnswer = next.answer ?? payload.answer;

    if (validationType) {
      this.validateQuestionShape(
        validationType,
        validationOptions ?? [],
        validationAnswer,
        isPartial,
      );
    }

    return next;
  }

  private validateQuestionShape(
    type: QuestionType,
    options: Array<{ key: string; label: string }>,
    answer: unknown,
    isPartial: boolean,
  ): void {
    if (this.isChoiceType(type)) {
      if (options.length < 2) {
        throw new AppException(
          '选择题至少需要两个选项',
          ERROR_CODES.BAD_REQUEST,
          HttpStatus.BAD_REQUEST,
        );
      }

      const keySet = new Set<string>();
      for (const option of options) {
        if (!option.key || !option.label) {
          throw new AppException(
            '选项键值和内容不能为空',
            ERROR_CODES.BAD_REQUEST,
            HttpStatus.BAD_REQUEST,
          );
        }
        if (keySet.has(option.key)) {
          throw new AppException(
            '选项键值不能重复',
            ERROR_CODES.BAD_REQUEST,
            HttpStatus.BAD_REQUEST,
          );
        }
        keySet.add(option.key);
      }

      if (answer === undefined && isPartial) {
        return;
      }

      if (type === 'single_choice') {
        if (typeof answer !== 'string' || !keySet.has(answer)) {
          throw new AppException(
            '单选题参考答案必须对应一个有效选项',
            ERROR_CODES.BAD_REQUEST,
            HttpStatus.BAD_REQUEST,
          );
        }
      }

      if (type === 'multi_choice') {
        if (!Array.isArray(answer) || !answer.length) {
          throw new AppException(
            '多选题参考答案至少需要一个有效选项',
            ERROR_CODES.BAD_REQUEST,
            HttpStatus.BAD_REQUEST,
          );
        }

        const normalized = answer.filter(
          (item): item is string =>
            typeof item === 'string' && keySet.has(item),
        );

        if (normalized.length !== answer.length) {
          throw new AppException(
            '多选题参考答案必须全部对应有效选项',
            ERROR_CODES.BAD_REQUEST,
            HttpStatus.BAD_REQUEST,
          );
        }
      }

      return;
    }

    if (answer === undefined && isPartial) {
      return;
    }

    if (typeof answer !== 'string' || !answer.trim()) {
      throw new AppException(
        '当前题型参考答案不能为空',
        ERROR_CODES.BAD_REQUEST,
        HttpStatus.BAD_REQUEST,
      );
    }
  }

  private isChoiceType(type: QuestionType): boolean {
    return type === 'single_choice' || type === 'multi_choice';
  }
}
