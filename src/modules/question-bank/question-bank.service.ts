import { HttpStatus, Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import type { MulterFile } from 'multer';
import xlsx from 'xlsx';
import { ERROR_CODES } from '../../common/constants/error-codes';
import { AppException } from '../../common/exceptions/app.exception';
import type { UserRole } from '../../common/interfaces/auth-user.interface';
import { Course, type CourseDocument } from '../courses/schemas/course.schema';
import { CreateQuestionBankDto } from './dto/create-question-bank.dto';
import { ImportQuestionBankDto } from './dto/import-question-bank.dto';
import { QueryQuestionBankDto } from './dto/query-question-bank.dto';
import { UpdateQuestionBankDto } from './dto/update-question-bank.dto';
import {
  type QuestionBankImportResultDto,
  type QuestionBankItemDto,
  type QuestionBankPageDto,
} from './interfaces/question-bank-response.interface';
import {
  QuestionBank,
  type QuestionBankDocument,
  type QuestionType,
} from './schemas/question-bank.schema';

type SanitizedQuestionPayload = Partial<{
  title: string;
  description: string;
  type: QuestionType;
  options: Array<{ key: string; label: string }>;
  answer: unknown;
  analysis: string;
  score: number;
}>;

interface ParsedExcelRow {
  index: number;
  payload: CreateQuestionBankDto;
}

@Injectable()
export class QuestionBankService {
  constructor(
    @InjectModel(QuestionBank.name)
    private readonly questionBankModel: Model<QuestionBankDocument>,
    @InjectModel(Course.name)
    private readonly courseModel: Model<CourseDocument>,
  ) {}

  async getQuestionBank(
    query: QueryQuestionBankDto,
    userId: string,
    role: UserRole,
  ): Promise<QuestionBankPageDto> {
    const filter = await this.buildListFilter(query, userId, role);
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 10;
    const skip = (page - 1) * pageSize;

    const [items, total] = await Promise.all([
      this.questionBankModel
        .find(filter)
        .populate('courseId', 'title courseCode teacherId')
        .populate('ownerId', 'username fullName')
        .sort({ updatedAt: -1 })
        .skip(skip)
        .limit(pageSize),
      this.questionBankModel.countDocuments(filter),
    ]);

    return {
      items: items.map((item) => this.toQuestionBankItemDto(item)),
      total,
    };
  }

  async getQuestionById(
    questionId: string,
    userId: string,
    role: UserRole,
  ): Promise<QuestionBankItemDto> {
    const question = await this.findQuestionById(questionId);
    await this.assertCanAccessCourse(
      question.courseId.toString(),
      userId,
      role,
    );
    await question.populate('courseId', 'title courseCode teacherId');
    await question.populate('ownerId', 'username fullName');
    return this.toQuestionBankItemDto(question);
  }

  async createQuestion(
    payload: CreateQuestionBankDto,
    userId: string,
    role: UserRole,
  ): Promise<QuestionBankItemDto> {
    const course = await this.assertCanManageCourse(
      payload.courseId,
      userId,
      role,
    );
    const question = await this.createQuestionDocument(
      payload,
      course,
      this.toObjectId(userId),
    );
    return this.toQuestionBankItemDto(question);
  }

  async importQuestions(
    payload: ImportQuestionBankDto,
    file: MulterFile,
    userId: string,
    role: UserRole,
  ): Promise<QuestionBankImportResultDto> {
    const course = await this.assertCanManageCourse(
      payload.courseId,
      userId,
      role,
    );

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

    const rows = this.parseExcelRows(file.buffer, payload.courseId);
    const ownerId = this.toObjectId(userId);
    const items: QuestionBankItemDto[] = [];
    const errors: QuestionBankImportResultDto['errors'] = [];

    for (const row of rows) {
      try {
        const question = await this.createQuestionDocument(
          row.payload,
          course,
          ownerId,
        );
        items.push(this.toQuestionBankItemDto(question));
      } catch (error) {
        errors.push({
          index: row.index,
          title: row.payload.title,
          reason:
            error instanceof AppException
              ? error.message
              : '导入失败，请检查数据格式',
        });
      }
    }

    return {
      total: rows.length,
      successCount: items.length,
      errorCount: errors.length,
      items,
      errors,
    };
  }

  getImportTemplate(): { fileName: string; buffer: Buffer } {
    const rows = [
      [
        '请按模板填写题目数据。题型：single_choice / multi_choice / fill_text / rich_text。选择题选项格式：A:选项1;B:选项2；多选答案格式：A,B。',
      ],
      [
        'title',
        'type',
        'score',
        'options',
        'answer',
        'analysis',
        'description',
      ],
      [
        '# 题干',
        '题型',
        '分值',
        '选项（选择题必填）',
        '参考答案',
        '题目解析（可选）',
        '补充说明（可选）',
      ],
      [
        '单选题示例',
        'single_choice',
        5,
        'A:选项1;B:选项2',
        'A',
        '单选题解析示例',
        '',
      ],
      [
        '多选题示例',
        'multi_choice',
        10,
        'A:选项1;B:选项2;C:选项3',
        'A,B',
        '多选题解析示例',
        '',
      ],
      ['填空题示例', 'fill_text', 5, '', '示例填空答案', '填空题解析示例', ''],
      ['简答题示例', 'rich_text', 15, '', '示例简答答案', '简答题解析示例', ''],
    ];
    const guideRows = [
      ['字段', '说明', '是否必填', '示例'],
      ['title', '题干', '是', '单选题示例'],
      ['type', '题型', '是', 'single_choice'],
      ['score', '分值', '是', '5'],
      [
        'options',
        '选择题选项，格式 A:选项1;B:选项2',
        '选择题必填',
        'A:选项1;B:选项2',
      ],
      ['answer', '参考答案；多选用逗号分隔', '是', 'A 或 A,B'],
      ['analysis', '题目解析', '否', '单选题解析示例'],
      ['description', '补充说明', '否', '题目来源或说明'],
    ];

    const workbook = xlsx.utils.book_new();
    const worksheet = xlsx.utils.aoa_to_sheet(rows);
    const guideSheet = xlsx.utils.aoa_to_sheet(guideRows);

    worksheet['!merges'] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: 6 } }];
    worksheet['!cols'] = [
      { wch: 36 },
      { wch: 18 },
      { wch: 10 },
      { wch: 42 },
      { wch: 18 },
      { wch: 30 },
      { wch: 28 },
    ];
    guideSheet['!cols'] = [{ wch: 18 }, { wch: 34 }, { wch: 14 }, { wch: 28 }];

    xlsx.utils.book_append_sheet(workbook, worksheet, 'Template');
    xlsx.utils.book_append_sheet(workbook, guideSheet, 'Guide');
    const rawBuffer: unknown = xlsx.write(workbook, {
      bookType: 'xlsx',
      type: 'buffer',
    });
    const buffer = Buffer.isBuffer(rawBuffer)
      ? rawBuffer
      : Buffer.from(rawBuffer as Uint8Array);

    return {
      fileName: '题库导入模板.xlsx',
      buffer,
    };
  }

  async updateQuestion(
    questionId: string,
    payload: UpdateQuestionBankDto,
    userId: string,
    role: UserRole,
  ): Promise<QuestionBankItemDto> {
    const question = await this.findQuestionById(questionId);
    const nextCourseId = payload.courseId ?? question.courseId.toString();
    await this.assertCanManageCourse(nextCourseId, userId, role);
    const sanitized = this.sanitizePayload(payload, true);

    if (payload.courseId) {
      question.courseId = this.toObjectId(payload.courseId);
    }
    if (sanitized.title !== undefined) question.title = sanitized.title;
    if (sanitized.description !== undefined) {
      question.description = sanitized.description;
    }
    if (sanitized.type !== undefined) question.type = sanitized.type;
    if (sanitized.options !== undefined) question.options = sanitized.options;
    if (sanitized.answer !== undefined) question.answer = sanitized.answer;
    if (sanitized.analysis !== undefined)
      question.analysis = sanitized.analysis;
    if (sanitized.score !== undefined) question.score = sanitized.score;

    question.version += 1;
    await question.save();
    await question.populate('courseId', 'title courseCode teacherId');
    await question.populate('ownerId', 'username fullName');

    return this.toQuestionBankItemDto(question);
  }

  async deleteQuestion(
    questionId: string,
    userId: string,
    role: UserRole,
  ): Promise<void> {
    const question = await this.findQuestionById(questionId);
    await this.assertCanManageCourse(
      question.courseId.toString(),
      userId,
      role,
    );
    await this.questionBankModel.deleteOne({ _id: question._id });
  }

  async deleteQuestionsByCourseId(courseId: string): Promise<void> {
    await this.questionBankModel.deleteMany({
      courseId: this.toObjectId(courseId),
    });
  }

  private async createQuestionDocument(
    payload: CreateQuestionBankDto,
    course: CourseDocument,
    ownerId: Types.ObjectId,
  ): Promise<QuestionBankDocument> {
    const sanitized = this.sanitizePayload(payload);

    const created = await this.questionBankModel.create({
      ...sanitized,
      courseId: course._id,
      ownerId,
      version: 1,
      useCount: 0,
    });

    const question = await this.questionBankModel
      .findById(created._id)
      .populate('courseId', 'title courseCode teacherId')
      .populate('ownerId', 'username fullName');

    if (!question) {
      throw new AppException(
        '题目创建失败',
        ERROR_CODES.INTERNAL_SERVER_ERROR,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }

    return question;
  }

  private parseExcelRows(buffer: Buffer, courseId: string): ParsedExcelRow[] {
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

    const validRows: ParsedExcelRow[] = [];

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

  private async buildListFilter(
    query: QueryQuestionBankDto,
    userId: string,
    role: UserRole,
  ): Promise<Record<string, unknown>> {
    const filter: Record<string, unknown> = {};

    if (role === 'teacher') {
      const teacherCourses = await this.courseModel.find(
        { teacherId: this.toObjectId(userId) },
        { _id: 1 },
      );
      const courseIds = teacherCourses.map((course) => course._id);
      filter.courseId = { $in: courseIds };
    }

    if (query.courseId) {
      await this.assertCanAccessCourse(query.courseId, userId, role);
      filter.courseId = this.toObjectId(query.courseId);
    }

    if (query.type) {
      filter.type = query.type;
    }

    if (query.search?.trim()) {
      const search = query.search.trim();
      filter.$or = [
        { title: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } },
      ];
    }

    return filter;
  }

  private sanitizePayload(
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

  private async assertCanAccessCourse(
    courseId: string,
    userId: string,
    role: UserRole,
  ): Promise<CourseDocument> {
    const course = await this.courseModel.findById(this.toObjectId(courseId));
    if (!course) {
      throw new AppException(
        '课程不存在',
        ERROR_CODES.NOT_FOUND,
        HttpStatus.NOT_FOUND,
      );
    }

    if (role === 'admin') {
      return course;
    }

    if (course.teacherId.toString() !== userId) {
      throw new AppException(
        '无权访问当前课程题库',
        ERROR_CODES.FORBIDDEN,
        HttpStatus.FORBIDDEN,
      );
    }

    return course;
  }

  private async assertCanManageCourse(
    courseId: string,
    userId: string,
    role: UserRole,
  ): Promise<CourseDocument> {
    return this.assertCanAccessCourse(courseId, userId, role);
  }

  private async findQuestionById(
    questionId: string,
  ): Promise<QuestionBankDocument> {
    const question = await this.questionBankModel.findById(
      this.toObjectId(questionId),
    );
    if (!question) {
      throw new AppException(
        '题目不存在',
        ERROR_CODES.NOT_FOUND,
        HttpStatus.NOT_FOUND,
      );
    }
    return question;
  }

  private toQuestionBankItemDto(
    question: QuestionBankDocument,
  ): QuestionBankItemDto {
    const course = question.courseId as unknown as {
      _id?: Types.ObjectId;
      title?: string;
      courseCode?: string;
    };
    const owner = question.ownerId as unknown as {
      _id?: Types.ObjectId;
      username?: string;
      fullName?: string;
    };

    return {
      id: question._id.toString(),
      courseId:
        course && typeof course === 'object' && '_id' in course && course._id
          ? course._id.toString()
          : question.courseId.toString(),
      course:
        course && typeof course === 'object' && '_id' in course && course._id
          ? {
              id: course._id.toString(),
              title:
                typeof course.title === 'string' ? course.title : '未知课程',
              courseCode:
                typeof course.courseCode === 'string'
                  ? course.courseCode
                  : undefined,
            }
          : undefined,
      ownerId:
        owner && typeof owner === 'object' && '_id' in owner && owner._id
          ? owner._id.toString()
          : question.ownerId.toString(),
      owner:
        owner && typeof owner === 'object' && '_id' in owner && owner._id
          ? {
              id: owner._id.toString(),
              username:
                typeof owner.username === 'string' ? owner.username : 'unknown',
              fullName:
                typeof owner.fullName === 'string' ? owner.fullName : undefined,
            }
          : undefined,
      title: question.title,
      description: question.description,
      type: question.type,
      options: (question.options ?? []).map((item) => ({
        key: item.key,
        label: item.label,
      })),
      answer: question.answer,
      analysis: question.analysis,
      score: question.score,
      version: question.version,
      useCount: question.useCount,
      createdAt: question.createdAt.toISOString(),
      updatedAt: question.updatedAt.toISOString(),
    };
  }

  private toObjectId(value: string): Types.ObjectId {
    if (!Types.ObjectId.isValid(value)) {
      throw new AppException(
        'ID 格式不正确',
        ERROR_CODES.BAD_REQUEST,
        HttpStatus.BAD_REQUEST,
      );
    }
    return new Types.ObjectId(value);
  }
}
