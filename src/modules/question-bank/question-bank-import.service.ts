import { HttpStatus, Injectable } from '@nestjs/common';
import type { MulterFile } from 'multer';
import xlsx from 'xlsx';
import { ERROR_CODES } from '../../common/constants/error-codes';
import { AppException } from '../../common/exceptions/app.exception';
import type { ParsedQuestionImportRow } from './question-bank.types';
import type { QuestionType } from './schemas/question-bank.schema';

@Injectable()
export class QuestionBankImportService {
  assertImportFile(file: MulterFile): void {
    const lowerFileName = file.originalname.toLowerCase();
    const isExcel =
      file.mimetype.includes('sheet') ||
      file.mimetype.includes('excel') ||
      lowerFileName.endsWith('.xlsx') ||
      lowerFileName.endsWith('.xls');

    if (!isExcel) {
      throw new AppException(
        '仅支持导入 Excel 文件',
        ERROR_CODES.BAD_REQUEST,
        HttpStatus.BAD_REQUEST,
      );
    }
  }

  parseExcelRows(buffer: Buffer, courseId: string): ParsedQuestionImportRow[] {
    const workbook = xlsx.read(buffer, { type: 'buffer' });
    const sheetName = workbook.SheetNames[0];

    if (!sheetName) {
      throw new AppException(
        'Excel 文件缺少工作表',
        ERROR_CODES.BAD_REQUEST,
        HttpStatus.BAD_REQUEST,
      );
    }

    const worksheet = workbook.Sheets[sheetName];
    const rows = xlsx.utils.sheet_to_json<Record<string, unknown>>(worksheet, {
      defval: '',
      range: 2,
      header: [
        'title',
        'type',
        'score',
        'options',
        'answer',
        'analysis',
        'description',
      ],
    });

    const validRows: ParsedQuestionImportRow[] = [];

    rows.forEach((row, index) => {
      const title = this.readCellText(row.title);
      if (!title || title.startsWith('#')) {
        return;
      }

      const type = this.readCellText(row.type) as QuestionType;
      const normalizedOptions = this.parseOptionString(
        this.readCellText(row.options),
      );
      const normalizedAnswer = this.normalizeAnswerValue(
        type,
        this.readCellText(row.answer),
      );
      const scoreValue =
        typeof row.score === 'number'
          ? row.score
          : Number(this.readCellText(row.score));

      validRows.push({
        index: index + 1,
        payload: {
          courseId,
          title,
          type,
          score: Number.isFinite(scoreValue) ? scoreValue : 0,
          options: normalizedOptions,
          answer: normalizedAnswer,
          analysis: this.readCellText(row.analysis) || undefined,
          description: this.readCellText(row.description) || undefined,
        },
      });
    });

    if (!validRows.length) {
      throw new AppException(
        'Excel 中没有可导入的题目数据',
        ERROR_CODES.BAD_REQUEST,
        HttpStatus.BAD_REQUEST,
      );
    }

    if (validRows.length > 200) {
      throw new AppException(
        '单次最多导入 200 道题目',
        ERROR_CODES.BAD_REQUEST,
        HttpStatus.BAD_REQUEST,
      );
    }

    return validRows;
  }

  private parseOptionString(
    value: string,
  ): Array<{ key: string; label: string }> {
    if (!value) {
      return [];
    }

    return value
      .split(/;|\n/)
      .map((segment) => segment.trim())
      .filter(Boolean)
      .map((segment) => {
        const [rawKey, ...rest] = segment.split(':');
        return {
          key: rawKey?.trim() ?? '',
          label: rest.join(':').trim(),
        };
      })
      .filter((item) => item.key && item.label);
  }

  private normalizeAnswerValue(type: QuestionType, value: string): unknown {
    if (!value) {
      return '';
    }

    if (type === 'multi_choice') {
      return value
        .split(/,|，/)
        .map((item) => item.trim())
        .filter(Boolean);
    }

    return value;
  }

  private readCellText(value: unknown): string {
    if (typeof value === 'string') {
      return value.trim();
    }

    if (typeof value === 'number' || typeof value === 'boolean') {
      return String(value).trim();
    }

    return '';
  }
}
