import { HttpStatus, Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { ERROR_CODES } from '../../common/constants/error-codes';
import { AppException } from '../../common/exceptions/app.exception';
import type { UserRole } from '../../common/interfaces/auth-user.interface';
import { toObjectId } from '../../common/utils/model-value.util';
import {
  QuestionBank,
  type QuestionBankDocument,
} from '../question-bank/schemas/question-bank.schema';
import { AddTaskQuestionsFromBankDto } from './dto/add-task-questions-from-bank.dto';
import { ReorderTaskQuestionsDto } from './dto/reorder-task-questions.dto';
import type { TaskQuestionDto } from './interfaces/task-question-response.interface';
import {
  TaskQuestion,
  type TaskQuestionDocument,
} from './schemas/task-question.schema';
import { TaskPermissionService } from './task-permission.service';

@Injectable()
export class TaskQuestionsService {
  constructor(
    @InjectModel(TaskQuestion.name)
    private readonly taskQuestionModel: Model<TaskQuestionDocument>,
    @InjectModel(QuestionBank.name)
    private readonly questionBankModel: Model<QuestionBankDocument>,
    private readonly taskPermissionService: TaskPermissionService,
  ) {}

  async getTaskQuestions(
    taskId: string,
    userId: string,
    role: UserRole,
  ): Promise<TaskQuestionDto[]> {
    await this.taskPermissionService.getReadableTask(taskId, userId, role);

    const items = await this.taskQuestionModel
      .find({ taskId: toObjectId(taskId) })
      .sort({ order: 1, createdAt: 1 });

    return items.map((item) =>
      this.toTaskQuestionDto(item, role !== 'student'),
    );
  }

  async addQuestionsFromBank(
    taskId: string,
    payload: AddTaskQuestionsFromBankDto,
    userId: string,
    role: UserRole,
  ): Promise<TaskQuestionDto[]> {
    const task = await this.taskPermissionService.getManageableTask(
      taskId,
      userId,
      role,
    );
    this.assertTaskSupportsQuestions(task.type);

    const bankQuestions = await this.questionBankModel.find({
      _id: { $in: payload.questionBankIds.map((id) => toObjectId(id)) },
      courseId: task.courseId,
    });

    if (bankQuestions.length !== payload.questionBankIds.length) {
      throw new AppException(
        '存在不属于当前课程的题库题目',
        ERROR_CODES.BAD_REQUEST,
        HttpStatus.BAD_REQUEST,
      );
    }

    const existing = await this.taskQuestionModel.find(
      {
        taskId: task._id,
        questionBankId: { $in: bankQuestions.map((item) => item._id) },
      },
      { questionBankId: 1 },
    );
    const existingIds = new Set(
      existing
        .map((item) => item.questionBankId?.toString())
        .filter((value): value is string => Boolean(value)),
    );

    const currentCount = await this.taskQuestionModel.countDocuments({
      taskId: task._id,
    });
    const createPayload = bankQuestions
      .filter((item) => !existingIds.has(item._id.toString()))
      .map((item, index) => ({
        taskId: task._id,
        questionBankId: item._id,
        type: item.type,
        title: item.title,
        description: item.description,
        options: item.options,
        answer: item.answer,
        score: item.score,
        order: currentCount + index,
        analysis: item.analysis,
        bankVersion: item.version,
      }));

    if (!createPayload.length) {
      return this.getTaskQuestions(taskId, userId, role);
    }

    const created = await this.taskQuestionModel.insertMany(createPayload);
    await this.questionBankModel.updateMany(
      { _id: { $in: createPayload.map((item) => item.questionBankId) } },
      { $inc: { useCount: 1 } },
    );

    return created.map((item) => this.toTaskQuestionDto(item, true));
  }

  async reorderTaskQuestions(
    taskId: string,
    payload: ReorderTaskQuestionsDto,
    userId: string,
    role: UserRole,
  ): Promise<void> {
    const task = await this.taskPermissionService.getManageableTask(
      taskId,
      userId,
      role,
    );
    this.assertTaskSupportsQuestions(task.type);

    if (!payload.questionOrders.length) {
      return;
    }

    await this.taskQuestionModel.bulkWrite(
      payload.questionOrders.map((item) => ({
        updateOne: {
          filter: {
            _id: toObjectId(item.questionId),
            taskId: toObjectId(taskId),
          },
          update: { order: item.order },
        },
      })),
    );
  }

  async deleteTaskQuestion(
    questionId: string,
    userId: string,
    role: UserRole,
  ): Promise<void> {
    const question = await this.taskQuestionModel.findById(
      toObjectId(questionId),
    );

    if (!question) {
      throw new AppException(
        '任务题目不存在',
        ERROR_CODES.NOT_FOUND,
        HttpStatus.NOT_FOUND,
      );
    }

    await this.taskPermissionService.getManageableTask(
      question.taskId.toString(),
      userId,
      role,
    );

    await this.taskQuestionModel.deleteOne({ _id: question._id });

    if (question.questionBankId) {
      await this.questionBankModel.updateOne(
        { _id: question.questionBankId },
        { $inc: { useCount: -1 } },
      );
    }
  }

  private toTaskQuestionDto(
    question: TaskQuestionDocument,
    includeAnswer: boolean,
  ): TaskQuestionDto {
    return {
      id: question._id.toString(),
      taskId: question.taskId.toString(),
      questionBankId: question.questionBankId?.toString(),
      type: question.type,
      title: question.title,
      description: question.description || undefined,
      options: question.options.map((item) => ({
        key: item.key,
        label: item.label,
      })),
      answer: includeAnswer ? question.answer : undefined,
      score: question.score,
      order: question.order,
      analysis: question.analysis || undefined,
      bankVersion: question.bankVersion,
      createdAt: question.createdAt.toISOString(),
      updatedAt: question.updatedAt.toISOString(),
    };
  }

  private assertTaskSupportsQuestions(type: string) {
    if (type === 'homework' || type === 'quiz') {
      return;
    }

    throw new AppException(
      '当前任务类型暂不支持题目编排',
      ERROR_CODES.BAD_REQUEST,
      HttpStatus.BAD_REQUEST,
    );
  }
}
