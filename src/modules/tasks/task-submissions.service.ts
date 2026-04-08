import { HttpStatus, Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { ERROR_CODES } from '../../common/constants/error-codes';
import { AppException } from '../../common/exceptions/app.exception';
import type { UserRole } from '../../common/interfaces/auth-user.interface';
import { toObjectId } from '../../common/utils/model-value.util';
import { UploadStorageService } from '../uploads/upload-storage.service';
import { GradeTaskSubmissionDto } from './dto/grade-task-submission.dto';
import { QueryTaskSubmissionsDto } from './dto/query-task-submissions.dto';
import { SubmitTaskDto } from './dto/submit-task.dto';
import type {
  TaskSubmissionDto,
  TaskSubmissionsPageDto,
  TaskUserBriefDto,
} from './interfaces/task-response.interface';
import {
  TaskSubmission,
  TaskSubmissionDocument,
} from './schemas/task-submission.schema';
import { Task, TaskDocument, type TaskFile } from './schemas/task.schema';
import { TaskPermissionService } from './task-permission.service';

@Injectable()
export class TaskSubmissionsService {
  constructor(
    @InjectModel(Task.name)
    private readonly taskModel: Model<TaskDocument>,
    @InjectModel(TaskSubmission.name)
    private readonly taskSubmissionModel: Model<TaskSubmissionDocument>,
    private readonly taskPermissionService: TaskPermissionService,
    private readonly uploadStorageService: UploadStorageService,
  ) {}

  async getCurrentSubmission(
    taskId: string,
    userId: string,
    role: UserRole,
  ): Promise<TaskSubmissionDto | null> {
    await this.taskPermissionService.getReadableTask(taskId, userId, role);

    const submission = await this.taskSubmissionModel
      .findOne({ taskId: toObjectId(taskId), userId: toObjectId(userId) })
      .populate('userId', 'username fullName');

    if (!submission) {
      return null;
    }

    return this.toSubmissionDto(submission);
  }

  async submitTask(
    taskId: string,
    payload: SubmitTaskDto,
    userId: string,
    role: UserRole,
  ): Promise<TaskSubmissionDto> {
    if (role !== 'student') {
      throw new AppException(
        '只有学生可以提交任务',
        ERROR_CODES.FORBIDDEN,
        HttpStatus.FORBIDDEN,
      );
    }

    const task = await this.taskPermissionService.getReadableTask(
      taskId,
      userId,
      role,
    );
    const content = payload.content?.trim() ?? '';
    const attachments = this.normalizeFiles(payload.attachments);

    if (!content && !attachments.length) {
      throw new AppException(
        '提交内容不能为空',
        ERROR_CODES.BAD_REQUEST,
        HttpStatus.BAD_REQUEST,
      );
    }

    const existing = await this.taskSubmissionModel.findOne({
      taskId: task._id,
      userId: toObjectId(userId),
    });

    if (existing && existing.status === 'graded') {
      throw new AppException(
        '该任务已评分，暂不支持重新提交',
        ERROR_CODES.BAD_REQUEST,
        HttpStatus.BAD_REQUEST,
      );
    }

    const submission =
      existing ??
      new this.taskSubmissionModel({
        taskId: task._id,
        userId: toObjectId(userId),
      });

    const removedAttachmentKeys = existing
      ? this.collectRemovedFileKeys(existing.attachments, attachments)
      : [];

    submission.content = content;
    submission.attachments = attachments;
    submission.submittedAt = new Date();
    submission.status = 'submitted';
    submission.score = undefined;
    submission.feedback = '';
    submission.gradedBy = undefined;
    submission.gradedAt = null;
    submission.maxScore = task.totalScore;

    await submission.save();
    await submission.populate('userId', 'username fullName');
    await this.removeStoredFiles(removedAttachmentKeys);

    return this.toSubmissionDto(submission);
  }

  async getTaskSubmissions(
    taskId: string,
    userId: string,
    role: UserRole,
    query: QueryTaskSubmissionsDto,
  ): Promise<TaskSubmissionsPageDto> {
    await this.taskPermissionService.getManageableTask(taskId, userId, role);

    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 10;
    const skip = (page - 1) * pageSize;

    const [items, total] = await Promise.all([
      this.taskSubmissionModel
        .find({ taskId: toObjectId(taskId) })
        .populate('userId', 'username fullName')
        .sort({ submittedAt: -1, updatedAt: -1 })
        .skip(skip)
        .limit(pageSize),
      this.taskSubmissionModel.countDocuments({ taskId: toObjectId(taskId) }),
    ]);

    return {
      items: items.map((item) => this.toSubmissionDto(item)),
      total,
    };
  }

  async gradeSubmission(
    taskId: string,
    payload: GradeTaskSubmissionDto,
    userId: string,
    role: UserRole,
  ): Promise<TaskSubmissionDto> {
    await this.taskPermissionService.getManageableTask(taskId, userId, role);
    const task = await this.taskModel.findById(toObjectId(taskId));

    if (!task) {
      throw new AppException(
        '任务不存在',
        ERROR_CODES.NOT_FOUND,
        HttpStatus.NOT_FOUND,
      );
    }

    if (payload.score > task.totalScore) {
      throw new AppException(
        '评分不能高于任务总分',
        ERROR_CODES.BAD_REQUEST,
        HttpStatus.BAD_REQUEST,
      );
    }

    const submission = await this.taskSubmissionModel
      .findOne({
        taskId: task._id,
        userId: toObjectId(payload.studentId),
      })
      .populate('userId', 'username fullName');

    if (!submission) {
      throw new AppException(
        '该学生尚未提交任务',
        ERROR_CODES.NOT_FOUND,
        HttpStatus.NOT_FOUND,
      );
    }

    submission.score = payload.score;
    submission.feedback = payload.feedback?.trim() ?? '';
    submission.status = 'graded';
    submission.gradedBy = toObjectId(userId);
    submission.gradedAt = new Date();
    submission.maxScore = task.totalScore;

    await submission.save();
    await submission.populate('userId', 'username fullName');

    return this.toSubmissionDto(submission);
  }

  private normalizeFiles(files: SubmitTaskDto['attachments'] = []): TaskFile[] {
    return files.map((file) => ({
      key: file.key.trim(),
      url: file.url.trim(),
      originalName: file.originalName.trim(),
      size: file.size,
      mimeType: file.mimeType.trim(),
      name: file.name?.trim() || file.originalName.trim(),
    }));
  }

  private toSubmissionDto(
    submission: TaskSubmissionDocument,
  ): TaskSubmissionDto {
    const user = this.toUserBrief(submission.userId);

    return {
      id: submission._id.toString(),
      taskId: submission.taskId.toString(),
      userId: user.id,
      content: submission.content || undefined,
      attachments: submission.attachments.map((file) => ({
        key: file.key,
        url: file.url,
        originalName: file.originalName,
        size: file.size,
        mimeType: file.mimeType,
        name: file.name,
      })),
      submittedAt: submission.submittedAt.toISOString(),
      status: submission.status,
      score: submission.score,
      maxScore: submission.maxScore,
      feedback: submission.feedback || undefined,
      gradedBy: submission.gradedBy?.toString(),
      gradedAt: submission.gradedAt ? submission.gradedAt.toISOString() : null,
      user,
      createdAt: submission.createdAt.toISOString(),
      updatedAt: submission.updatedAt.toISOString(),
    };
  }

  private toUserBrief(
    rawUser: TaskSubmissionDocument['userId'],
  ): TaskUserBriefDto {
    if (rawUser instanceof Types.ObjectId) {
      return {
        id: rawUser.toString(),
        username: '',
      };
    }

    const user = rawUser as Types.ObjectId & {
      _id?: Types.ObjectId;
      username?: string;
      fullName?: string;
    };

    return {
      id: user._id?.toString() ?? '',
      username: user.username ?? '',
      fullName: user.fullName,
    };
  }

  private collectRemovedFileKeys(previous: TaskFile[], next: TaskFile[]) {
    const nextKeySet = new Set(next.map((item) => item.key));
    return previous
      .map((item) => item.key)
      .filter((key) => !nextKeySet.has(key));
  }

  private async removeStoredFiles(fileKeys: string[]) {
    await Promise.all(
      [...new Set(fileKeys.filter(Boolean))].map((fileKey) =>
        this.uploadStorageService.removeStoredFileByKey(fileKey),
      ),
    );
  }
}
