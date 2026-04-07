import { HttpStatus, Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import type { MulterFile } from 'multer';
import { ERROR_CODES } from '../../common/constants/error-codes';
import { AppException } from '../../common/exceptions/app.exception';
import type { UserRole } from '../../common/interfaces/auth-user.interface';
import { toObjectId } from '../../common/utils/model-value.util';
import { CoursePermissionService } from '../courses/course-permission.service';
import { Course, type CourseDocument } from '../courses/schemas/course.schema';
import { CreateQuestionBankDto } from './dto/create-question-bank.dto';
import { ImportQuestionBankDto } from './dto/import-question-bank.dto';
import { QueryQuestionBankDto } from './dto/query-question-bank.dto';
import { UpdateQuestionBankDto } from './dto/update-question-bank.dto';
import { QuestionBankImportService } from './question-bank-import.service';
import { QuestionBankTemplateService } from './question-bank-template.service';
import { QuestionBankValidatorService } from './question-bank-validator.service';
import {
  type QuestionBankImportResultDto,
  type QuestionBankItemDto,
  type QuestionBankPageDto,
} from './interfaces/question-bank-response.interface';
import {
  QuestionBank,
  type QuestionBankDocument,
} from './schemas/question-bank.schema';

@Injectable()
export class QuestionBankService {
  constructor(
    @InjectModel(QuestionBank.name)
    private readonly questionBankModel: Model<QuestionBankDocument>,
    @InjectModel(Course.name)
    private readonly courseModel: Model<CourseDocument>,
    private readonly coursePermissionService: CoursePermissionService,
    private readonly questionBankImportService: QuestionBankImportService,
    private readonly questionBankTemplateService: QuestionBankTemplateService,
    private readonly questionBankValidatorService: QuestionBankValidatorService,
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
      toObjectId(userId),
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

    this.questionBankImportService.assertImportFile(file);

    const rows = this.questionBankImportService.parseExcelRows(
      file.buffer,
      payload.courseId,
    );
    const ownerId = toObjectId(userId);
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
    return this.questionBankTemplateService.getImportTemplate();
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
    const sanitized = this.questionBankValidatorService.sanitizePayload(
      payload,
      true,
    );

    if (payload.courseId) {
      question.courseId = toObjectId(payload.courseId);
    }
    if (sanitized.title !== undefined) question.title = sanitized.title;
    if (sanitized.description !== undefined) {
      question.description = sanitized.description;
    }
    if (sanitized.type !== undefined) question.type = sanitized.type;
    if (sanitized.options !== undefined) question.options = sanitized.options;
    if (sanitized.answer !== undefined) question.answer = sanitized.answer;
    if (sanitized.analysis !== undefined) {
      question.analysis = sanitized.analysis;
    }
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
      courseId: toObjectId(courseId),
    });
  }

  private async createQuestionDocument(
    payload: CreateQuestionBankDto,
    course: CourseDocument,
    ownerId: Types.ObjectId,
  ): Promise<QuestionBankDocument> {
    const sanitized =
      this.questionBankValidatorService.sanitizePayload(payload);

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

  private async buildListFilter(
    query: QueryQuestionBankDto,
    userId: string,
    role: UserRole,
  ): Promise<Record<string, unknown>> {
    const filter: Record<string, unknown> = {};

    if (role === 'teacher') {
      const teacherCourses = await this.courseModel.find(
        { teacherId: toObjectId(userId) },
        { _id: 1 },
      );
      filter.courseId = { $in: teacherCourses.map((course) => course._id) };
    }

    if (query.courseId) {
      await this.assertCanAccessCourse(query.courseId, userId, role);
      filter.courseId = toObjectId(query.courseId);
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

  private async assertCanAccessCourse(
    courseId: string,
    userId: string,
    role: UserRole,
  ): Promise<CourseDocument> {
    return this.coursePermissionService.getManageableCourse(
      courseId,
      userId,
      role,
      {
        notFoundMessage: '课程不存在',
        forbiddenMessage: '无权访问当前课程题库',
        studentForbiddenMessage: '学生不能访问课程题库',
      },
    );
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
      toObjectId(questionId),
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
}
