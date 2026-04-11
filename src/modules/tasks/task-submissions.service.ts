import { HttpStatus, Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { ERROR_CODES } from '../../common/constants/error-codes';
import { AppException } from '../../common/exceptions/app.exception';
import type { UserRole } from '../../common/interfaces/auth-user.interface';
import { readObjectId, toObjectId } from '../../common/utils/model-value.util';
import { UploadStorageService } from '../uploads/upload-storage.service';
import { NotificationsService } from '../notifications/notifications.service';
import {
  GradeTaskAnswerDto,
  GradeTaskSubmissionDto,
} from './dto/grade-task-submission.dto';
import { QueryTaskSubmissionsDto } from './dto/query-task-submissions.dto';
import { SubmitTaskAnswerDto, SubmitTaskDto } from './dto/submit-task.dto';
import type {
  PendingGradingItemDto,
  TaskSubmissionAnswerDto,
  TaskSubmissionDto,
  TaskSubmissionsPageDto,
  TaskUserBriefDto,
} from './interfaces/task-response.interface';
import {
  TaskQuestion,
  type TaskQuestionDocument,
  type TaskQuestionType,
} from './schemas/task-question.schema';
import {
  TaskSubmission,
  type TaskSubmissionDocument,
} from './schemas/task-submission.schema';
import { Task, type TaskDocument, type TaskFile } from './schemas/task.schema';
import { TaskPermissionService } from './task-permission.service';

type SubmissionAnswerRecord = {
  questionId: Types.ObjectId;
  answer: unknown;
  autoScore: number;
  manualScore: number | null;
  comments: string;
};

@Injectable()
export class TaskSubmissionsService {
  private readonly logger = new Logger(TaskSubmissionsService.name);

  constructor(
    @InjectModel(Task.name)
    private readonly taskModel: Model<TaskDocument>,
    @InjectModel(TaskQuestion.name)
    private readonly taskQuestionModel: Model<TaskQuestionDocument>,
    @InjectModel(TaskSubmission.name)
    private readonly taskSubmissionModel: Model<TaskSubmissionDocument>,
    private readonly taskPermissionService: TaskPermissionService,
    private readonly uploadStorageService: UploadStorageService,
    private readonly notificationsService: NotificationsService,
  ) {}

  async getCurrentSubmission(
    taskId: string,
    userId: string,
    role: UserRole,
  ): Promise<TaskSubmissionDto | null> {
    await this.taskPermissionService.getReadableTask(taskId, userId, role);

    const [submission, questions] = await Promise.all([
      this.taskSubmissionModel
        .findOne({ taskId: toObjectId(taskId), userId: toObjectId(userId) })
        .populate('userId', 'username fullName'),
      this.getTaskQuestions(taskId),
    ]);

    if (!submission) {
      return null;
    }

    return this.toSubmissionDto(submission, questions);
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
    const questions = await this.getTaskQuestions(taskId);
    const answers = this.supportsStructuredAnswers(task.type)
      ? this.buildStudentAnswers(questions, payload.answers)
      : [];

    if (!this.hasSubmissionContent(content, attachments, answers)) {
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
    submission.answers = answers;
    submission.submittedAt = new Date();
    submission.status = 'submitted';
    submission.score = this.calculateSubmissionScore(answers);
    submission.feedback = '';
    submission.gradedBy = undefined;
    submission.gradedAt = null;
    submission.maxScore = task.totalScore;

    await submission.save();
    await submission.populate('userId', 'username fullName');
    await this.removeStoredFiles(removedAttachmentKeys);

    return this.toSubmissionDto(submission, questions);
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

    const [items, total, questions] = await Promise.all([
      this.taskSubmissionModel
        .find({ taskId: toObjectId(taskId) })
        .populate('userId', 'username fullName')
        .sort({ submittedAt: -1, updatedAt: -1 })
        .skip(skip)
        .limit(pageSize),
      this.taskSubmissionModel.countDocuments({ taskId: toObjectId(taskId) }),
      this.getTaskQuestions(taskId),
    ]);

    return {
      items: items.map((item) => this.toSubmissionDto(item, questions)),
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
    const [task, questions] = await Promise.all([
      this.taskModel.findById(toObjectId(taskId)),
      this.getTaskQuestions(taskId),
    ]);

    if (!task) {
      throw new AppException(
        '任务不存在',
        ERROR_CODES.NOT_FOUND,
        HttpStatus.NOT_FOUND,
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

    const answers =
      this.supportsStructuredAnswers(task.type) && questions.length
        ? this.mergeTeacherAnswers(
            questions,
            submission.answers,
            payload.answers,
          )
        : this.normalizeExistingAnswers(submission.answers);
    const score =
      answers.length > 0
        ? this.calculateSubmissionScore(answers)
        : payload.score;

    if (score === undefined) {
      throw new AppException(
        '请提供评分结果',
        ERROR_CODES.BAD_REQUEST,
        HttpStatus.BAD_REQUEST,
      );
    }

    if (score > task.totalScore) {
      throw new AppException(
        '评分不能高于任务总分',
        ERROR_CODES.BAD_REQUEST,
        HttpStatus.BAD_REQUEST,
      );
    }

    submission.answers = answers;
    submission.score = score;
    submission.feedback = payload.feedback?.trim() ?? '';
    submission.status = 'graded';
    submission.gradedBy = toObjectId(userId);
    submission.gradedAt = new Date();
    submission.maxScore = task.totalScore;
    submission.revisionHistory = [
      ...(submission.revisionHistory ?? []),
      {
        gradedBy: toObjectId(userId),
        score,
        feedback: payload.feedback?.trim() ?? '',
        gradedAt: new Date(),
      },
    ];

    await submission.save();
    await submission.populate('userId', 'username fullName');

    try {
      await this.notificationsService.createNotification({
        recipientId: payload.studentId,
        type: 'task_graded',
        title: '任务已评分',
        content: `你的任务“${task.title}”已完成评分，当前得分为 ${score} / ${task.totalScore}。`,
        relatedId: task._id,
        relatedType: 'task',
      });
    } catch (error) {
      this.logger.error('创建任务评分通知失败', error);
    }

    return this.toSubmissionDto(submission, questions);
  }

  async getPendingGrading(
    userId: string,
    role: UserRole,
    limit = 6,
  ): Promise<PendingGradingItemDto[]> {
    if (role !== 'teacher' && role !== 'admin') {
      throw new AppException(
        '只有教师和管理员可以查看待批改列表',
        ERROR_CODES.FORBIDDEN,
        HttpStatus.FORBIDDEN,
      );
    }

    const taskFilter: Record<string, unknown> = {};
    if (role === 'teacher') {
      taskFilter.creatorId = toObjectId(userId);
    }

    const taskIds = (
      await this.taskModel.find(taskFilter, { _id: 1 }).lean()
    ).map((item) => item._id);

    if (!taskIds.length) {
      return [];
    }

    const submissions = await this.taskSubmissionModel
      .find({
        taskId: { $in: taskIds },
        status: 'submitted',
      })
      .populate({
        path: 'taskId',
        select: 'title type courseId dueDate totalScore',
        populate: {
          path: 'courseId',
          select: 'title',
        },
      })
      .populate('userId', 'username fullName')
      .sort({ submittedAt: -1, createdAt: -1 })
      .limit(limit);

    return submissions
      .map((submission) => {
        const task = submission.taskId as unknown as {
          _id?: Types.ObjectId;
          title?: string;
          type?: PendingGradingItemDto['taskType'];
          dueDate?: Date;
          totalScore?: number;
          courseId?: Types.ObjectId & { _id?: Types.ObjectId; title?: string };
        };
        const student = submission.userId as unknown as {
          _id?: Types.ObjectId;
          username?: string;
          fullName?: string;
        };

        if (!task?._id || !task.courseId || !student?._id) {
          return null;
        }

        return {
          submissionId: submission._id.toString(),
          taskId: task._id.toString(),
          taskTitle: task.title ?? '',
          taskType: task.type ?? 'homework',
          courseId: task.courseId._id?.toString() ?? '',
          courseTitle: task.courseId.title ?? '',
          studentId: student._id.toString(),
          studentName: student.fullName ?? student.username ?? '未命名学生',
          submittedAt: submission.submittedAt.toISOString(),
          dueDate:
            task.dueDate?.toISOString() ?? submission.submittedAt.toISOString(),
          maxScore: task.totalScore ?? submission.maxScore,
        } satisfies PendingGradingItemDto;
      })
      .filter((item): item is PendingGradingItemDto => Boolean(item));
  }

  private async getTaskQuestions(taskId: string) {
    return this.taskQuestionModel
      .find({ taskId: toObjectId(taskId) })
      .sort({ order: 1, createdAt: 1 });
  }

  private supportsStructuredAnswers(type: Task['type']) {
    return type === 'homework' || type === 'quiz';
  }

  private buildStudentAnswers(
    questions: TaskQuestionDocument[],
    rawAnswers: SubmitTaskAnswerDto[] = [],
  ): SubmissionAnswerRecord[] {
    this.assertKnownQuestions(
      questions,
      rawAnswers.map((item) => item.questionId),
    );

    const inputMap = new Map(rawAnswers.map((item) => [item.questionId, item]));

    return questions.map((question) => {
      const rawAnswer = inputMap.get(question._id.toString());
      const answer = this.normalizeAnswerValue(
        rawAnswer?.answer,
        question.type,
      );

      return {
        questionId: question._id,
        answer,
        autoScore: this.calculateAutoScore(question, answer),
        manualScore: null,
        comments: '',
      };
    });
  }

  private mergeTeacherAnswers(
    questions: TaskQuestionDocument[],
    existingAnswers: TaskSubmissionDocument['answers'] = [],
    overrides: GradeTaskAnswerDto[] = [],
  ): SubmissionAnswerRecord[] {
    this.assertKnownQuestions(
      questions,
      overrides.map((item) => item.questionId),
    );

    const overrideMap = new Map<string, GradeTaskAnswerDto>(
      overrides.map((item): [string, GradeTaskAnswerDto] => [
        item.questionId,
        item,
      ]),
    );
    const existingMap = new Map<string, SubmissionAnswerRecord>(
      this.normalizeExistingAnswers(existingAnswers).map(
        (item): [string, SubmissionAnswerRecord] => [
          item.questionId.toString(),
          item,
        ],
      ),
    );

    return questions.map((question) => {
      const questionId = question._id.toString();
      const override = overrideMap.get(questionId);
      const existing = existingMap.get(questionId);
      const hasOverrideAnswer = override !== undefined && 'answer' in override;
      const answer = hasOverrideAnswer
        ? this.normalizeAnswerValue(override?.answer, question.type)
        : this.normalizeAnswerValue(existing?.answer, question.type);
      const autoScore = this.calculateAutoScore(question, answer);
      const manualScore = this.normalizeManualScore(
        override?.manualScore ?? existing?.manualScore ?? null,
        question.score,
      );

      return {
        questionId: question._id,
        answer,
        autoScore,
        manualScore,
        comments: override?.comments?.trim() ?? existing?.comments ?? '',
      };
    });
  }

  private normalizeExistingAnswers(
    answers: TaskSubmissionDocument['answers'] = [],
  ): SubmissionAnswerRecord[] {
    return (answers ?? []).map((item) => ({
      questionId: toObjectId(readObjectId(item.questionId)),
      answer: item.answer ?? null,
      autoScore: item.autoScore ?? 0,
      manualScore: item.manualScore ?? null,
      comments: item.comments ?? '',
    }));
  }

  private assertKnownQuestions(
    questions: TaskQuestionDocument[],
    questionIds: string[],
  ) {
    const knownIds = new Set(questions.map((item) => item._id.toString()));
    const invalidId = questionIds.find((item) => !knownIds.has(item));

    if (invalidId) {
      throw new AppException(
        '存在不属于当前任务的题目',
        ERROR_CODES.BAD_REQUEST,
        HttpStatus.BAD_REQUEST,
      );
    }
  }

  private normalizeAnswerValue(value: unknown, type: TaskQuestionType) {
    switch (type) {
      case 'single_choice': {
        const normalized = typeof value === 'string' ? value.trim() : '';
        return normalized || null;
      }
      case 'multi_choice': {
        if (!Array.isArray(value)) {
          return [];
        }

        return [
          ...new Set(value.map((item) => String(item).trim()).filter(Boolean)),
        ].sort();
      }
      case 'fill_text':
      case 'rich_text': {
        const normalized = typeof value === 'string' ? value.trim() : '';
        return normalized || null;
      }
      default:
        return value ?? null;
    }
  }

  private calculateAutoScore(
    question: TaskQuestionDocument,
    answer: unknown,
  ): number {
    if (answer === null || answer === undefined) {
      return 0;
    }

    switch (question.type) {
      case 'single_choice':
        return this.toComparableString(question.answer) ===
          this.toComparableString(answer)
          ? question.score
          : 0;
      case 'multi_choice':
        return this.matchesMultiChoice(question.answer, answer)
          ? question.score
          : 0;
      case 'fill_text':
        return this.matchesFillText(question.answer, answer)
          ? question.score
          : 0;
      default:
        return 0;
    }
  }

  private matchesMultiChoice(correctAnswer: unknown, answer: unknown) {
    const expected = Array.isArray(correctAnswer)
      ? [
          ...new Set(
            correctAnswer.map((item) => String(item).trim()).filter(Boolean),
          ),
        ].sort()
      : this.normalizeStringList(correctAnswer);
    const actual = Array.isArray(answer)
      ? [
          ...new Set(answer.map((item) => String(item).trim()).filter(Boolean)),
        ].sort()
      : this.normalizeStringList(answer);

    return expected.join('|') === actual.join('|');
  }

  private matchesFillText(correctAnswer: unknown, answer: unknown) {
    const normalizedAnswer = this.toComparableString(answer);
    if (!normalizedAnswer) {
      return false;
    }

    const acceptableAnswers = Array.isArray(correctAnswer)
      ? correctAnswer
      : [correctAnswer];

    return acceptableAnswers
      .map((item) => this.toComparableString(item))
      .filter(Boolean)
      .includes(normalizedAnswer);
  }

  private normalizeStringList(value: unknown) {
    const normalized = this.toComparableString(value);
    return normalized ? [normalized] : [];
  }

  private toComparableString(value: unknown) {
    if (typeof value === 'string') {
      return value.trim();
    }

    if (typeof value === 'number' || typeof value === 'boolean') {
      return String(value);
    }

    return '';
  }

  private normalizeManualScore(score: number | null, maxScore: number) {
    if (score === null || score === undefined) {
      return null;
    }

    if (score > maxScore) {
      throw new AppException(
        '单题评分不能高于题目分值',
        ERROR_CODES.BAD_REQUEST,
        HttpStatus.BAD_REQUEST,
      );
    }

    return score;
  }

  private calculateSubmissionScore(
    answers: Array<{ autoScore?: number; manualScore?: number | null }>,
  ) {
    return answers.reduce(
      (total, item) => total + (item.manualScore ?? item.autoScore ?? 0),
      0,
    );
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

  private hasSubmissionContent(
    content: string,
    attachments: TaskFile[],
    answers: Array<{ answer?: unknown }> = [],
  ) {
    return (
      Boolean(content) ||
      attachments.length > 0 ||
      answers.some((item) => this.hasMeaningfulAnswer(item.answer))
    );
  }

  private hasMeaningfulAnswer(value: unknown) {
    if (Array.isArray(value)) {
      return value.length > 0;
    }

    if (typeof value === 'string') {
      return Boolean(value.trim());
    }

    return value !== null && value !== undefined;
  }

  private toSubmissionDto(
    submission: TaskSubmissionDocument,
    questions: TaskQuestionDocument[] = [],
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
      answers: this.toSubmissionAnswerDtos(submission.answers, questions),
      submittedAt: submission.submittedAt.toISOString(),
      status: submission.status,
      score: submission.score,
      maxScore: submission.maxScore,
      feedback: submission.feedback || undefined,
      gradedBy: submission.gradedBy?.toString(),
      gradedAt: submission.gradedAt ? submission.gradedAt.toISOString() : null,
      revisionHistory: (submission.revisionHistory ?? []).map((item) => ({
        gradedBy: item.gradedBy?.toString(),
        score: item.score,
        feedback: item.feedback || undefined,
        gradedAt: item.gradedAt.toISOString(),
      })),
      user,
      createdAt: submission.createdAt.toISOString(),
      updatedAt: submission.updatedAt.toISOString(),
    };
  }

  private toSubmissionAnswerDtos(
    answers: TaskSubmissionDocument['answers'] = [],
    questions: TaskQuestionDocument[] = [],
  ): TaskSubmissionAnswerDto[] {
    const answerMap = new Map(
      this.normalizeExistingAnswers(answers).map((item) => [
        item.questionId.toString(),
        {
          questionId: item.questionId.toString(),
          answer: item.answer ?? null,
          autoScore: item.autoScore,
          manualScore: item.manualScore,
          comments: item.comments || undefined,
        },
      ]),
    );

    if (!questions.length) {
      return [...answerMap.values()];
    }

    return questions.map((question) => {
      const existing = answerMap.get(question._id.toString());

      return {
        questionId: question._id.toString(),
        answer: existing?.answer ?? null,
        autoScore: existing?.autoScore ?? 0,
        manualScore: existing?.manualScore ?? null,
        comments: existing?.comments,
      };
    });
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
