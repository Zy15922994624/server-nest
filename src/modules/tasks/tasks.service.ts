import { HttpStatus, Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { ERROR_CODES } from '../../common/constants/error-codes';
import { AppException } from '../../common/exceptions/app.exception';
import type { UserRole } from '../../common/interfaces/auth-user.interface';
import { toObjectId } from '../../common/utils/model-value.util';
import { CoursePermissionService } from '../courses/course-permission.service';
import {
  CourseMember,
  CourseMemberDocument,
} from '../courses/schemas/course-member.schema';
import { Course, CourseDocument } from '../courses/schemas/course.schema';
import {
  CourseResource,
  CourseResourceDocument,
} from '../course-resources/schemas/course-resource.schema';
import {
  QuestionBank,
  QuestionBankDocument,
} from '../question-bank/schemas/question-bank.schema';
import { UploadStorageService } from '../uploads/upload-storage.service';
import { User, UserDocument } from '../users/schemas/user.schema';
import {
  CreateTaskDto,
  taskAssignmentModeValues,
  taskTypeValues,
} from './dto/create-task.dto';
import { QueryTasksDto } from './dto/query-tasks.dto';
import { UpdateTaskDto } from './dto/update-task.dto';
import type {
  TaskCourseBriefDto,
  TaskDetailDto,
  TaskItemDto,
  TasksPageDto,
  TaskUserBriefDto,
} from './interfaces/task-response.interface';
import {
  TaskAssignment,
  TaskAssignmentDocument,
} from './schemas/task-assignment.schema';
import {
  TaskQuestion,
  TaskQuestionDocument,
} from './schemas/task-question.schema';
import {
  TaskSubmission,
  TaskSubmissionDocument,
} from './schemas/task-submission.schema';
import { Task, TaskDocument, type TaskFile } from './schemas/task.schema';
import { TaskPermissionService } from './task-permission.service';

interface CountAggregation {
  _id: Types.ObjectId;
  count: number;
}

interface SubmissionCountAggregation {
  _id: Types.ObjectId;
  submittedCount: number;
  gradedCount: number;
}

@Injectable()
export class TasksService {
  constructor(
    @InjectModel(Task.name)
    private readonly taskModel: Model<TaskDocument>,
    @InjectModel(TaskAssignment.name)
    private readonly taskAssignmentModel: Model<TaskAssignmentDocument>,
    @InjectModel(TaskSubmission.name)
    private readonly taskSubmissionModel: Model<TaskSubmissionDocument>,
    @InjectModel(TaskQuestion.name)
    private readonly taskQuestionModel: Model<TaskQuestionDocument>,
    @InjectModel(QuestionBank.name)
    private readonly questionBankModel: Model<QuestionBankDocument>,
    @InjectModel(Course.name)
    private readonly courseModel: Model<CourseDocument>,
    @InjectModel(CourseMember.name)
    private readonly courseMemberModel: Model<CourseMemberDocument>,
    @InjectModel(CourseResource.name)
    private readonly courseResourceModel: Model<CourseResourceDocument>,
    @InjectModel(User.name)
    private readonly userModel: Model<UserDocument>,
    private readonly coursePermissionService: CoursePermissionService,
    private readonly taskPermissionService: TaskPermissionService,
    private readonly uploadStorageService: UploadStorageService,
  ) {}

  async createTask(
    payload: CreateTaskDto,
    userId: string,
    role: UserRole,
  ): Promise<TaskDetailDto> {
    await this.assertCanManageCourse(payload.courseId, userId, role);
    const sanitized = await this.sanitizeTaskPayload(payload, payload.courseId);

    const created = await this.taskModel.create({
      courseId: toObjectId(payload.courseId),
      title: sanitized.title,
      description: sanitized.description,
      type: sanitized.type,
      dueDate: sanitized.dueDate,
      totalScore: sanitized.totalScore,
      passingScore: sanitized.passingScore,
      attachments: sanitized.attachments,
      relatedResourceIds: sanitized.relatedResourceIds,
      isPublished: sanitized.isPublished,
      publishedAt: sanitized.publishedAt,
      assignmentMode: sanitized.assignmentMode,
      creatorId: toObjectId(userId),
    });

    await this.replaceTaskAssignments(
      created._id,
      sanitized.assignmentMode ?? 'all',
      sanitized.assignedStudentIds ?? [],
    );

    return this.getTaskById(created._id.toString(), userId, role);
  }

  async getTasks(
    userId: string,
    role: UserRole,
    query: QueryTasksDto,
  ): Promise<TasksPageDto> {
    const filter = await this.buildListFilter(userId, role, query);
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 10;
    const skip = (page - 1) * pageSize;

    const [items, total] = await Promise.all([
      this.taskModel
        .find(filter)
        .populate('courseId', 'title courseCode')
        .populate('creatorId', 'username fullName')
        .sort({ dueDate: 1, createdAt: -1 })
        .skip(skip)
        .limit(pageSize),
      this.taskModel.countDocuments(filter),
    ]);

    return {
      items: await this.toTaskItems(items, userId, role),
      total,
    };
  }

  async getTaskById(
    taskId: string,
    userId: string,
    role: UserRole,
  ): Promise<TaskDetailDto> {
    await this.taskPermissionService.getReadableTask(taskId, userId, role);

    const task = await this.taskModel
      .findById(toObjectId(taskId))
      .populate('courseId', 'title courseCode')
      .populate('creatorId', 'username fullName');

    if (!task) {
      throw new AppException(
        '任务不存在',
        ERROR_CODES.NOT_FOUND,
        HttpStatus.NOT_FOUND,
      );
    }

    const [item] = await this.toTaskItems([task], userId, role);
    const relatedResources = task.relatedResourceIds.length
      ? await this.courseResourceModel
          .find({ _id: { $in: task.relatedResourceIds } })
          .select('title type fileUrl originalFileName')
      : [];

    return {
      ...item,
      relatedResources: relatedResources.map((resource) => ({
        id: resource._id.toString(),
        title: resource.title,
        type: resource.type,
        fileUrl: resource.fileUrl,
        originalFileName: resource.originalFileName,
      })),
    };
  }

  async updateTask(
    taskId: string,
    payload: UpdateTaskDto,
    userId: string,
    role: UserRole,
  ): Promise<TaskDetailDto> {
    const task = await this.taskPermissionService.getManageableTask(
      taskId,
      userId,
      role,
    );

    const sanitized = await this.sanitizeTaskPayload(
      payload,
      task.courseId.toString(),
      { currentTask: task },
    );

    const removedAttachmentKeys =
      sanitized.attachments !== undefined
        ? this.collectRemovedFileKeys(task.attachments, sanitized.attachments)
        : [];

    task.title = sanitized.title ?? task.title;
    task.description = sanitized.description ?? task.description;
    task.type = sanitized.type ?? task.type;
    task.dueDate = sanitized.dueDate ?? task.dueDate;
    task.totalScore = sanitized.totalScore ?? task.totalScore;
    task.passingScore = sanitized.passingScore ?? task.passingScore;
    task.attachments = sanitized.attachments ?? task.attachments;
    task.relatedResourceIds =
      sanitized.relatedResourceIds ?? task.relatedResourceIds;
    task.isPublished = sanitized.isPublished ?? task.isPublished;
    task.publishedAt =
      sanitized.publishedAt !== undefined
        ? sanitized.publishedAt
        : task.publishedAt;
    task.assignmentMode = sanitized.assignmentMode ?? task.assignmentMode;

    await task.save();

    if (
      sanitized.assignmentMode !== undefined ||
      sanitized.assignedStudentIds !== undefined
    ) {
      await this.replaceTaskAssignments(
        task._id,
        task.assignmentMode,
        sanitized.assignedStudentIds ?? [],
      );
    }

    await this.removeStoredFiles(removedAttachmentKeys);

    return this.getTaskById(task._id.toString(), userId, role);
  }

  async deleteTask(
    taskId: string,
    userId: string,
    role: UserRole,
  ): Promise<void> {
    const task = await this.taskPermissionService.getManageableTask(
      taskId,
      userId,
      role,
    );

    const submissions = await this.taskSubmissionModel.find(
      { taskId: task._id },
      { attachments: 1 },
    );
    const taskQuestions = await this.taskQuestionModel.find(
      { taskId: task._id },
      { questionBankId: 1 },
    );
    const fileKeys = [
      ...task.attachments.map((item) => item.key),
      ...submissions.flatMap((submission) =>
        submission.attachments.map((item) => item.key),
      ),
    ];

    await Promise.all([
      this.taskModel.deleteOne({ _id: task._id }),
      this.taskAssignmentModel.deleteMany({ taskId: task._id }),
      this.taskQuestionModel.deleteMany({ taskId: task._id }),
      this.taskSubmissionModel.deleteMany({ taskId: task._id }),
    ]);

    const questionBankIds = taskQuestions
      .map((item) => item.questionBankId)
      .filter((value): value is Types.ObjectId => Boolean(value));

    if (questionBankIds.length) {
      await this.questionBankModel.updateMany(
        { _id: { $in: questionBankIds } },
        { $inc: { useCount: -1 } },
      );
    }

    await this.removeStoredFiles(fileKeys);
  }

  private async buildListFilter(
    userId: string,
    role: UserRole,
    query: QueryTasksDto,
  ): Promise<Record<string, unknown>> {
    const filter: Record<string, unknown> = {};
    const andFilters: Array<Record<string, unknown>> = [];

    if (query.search?.trim()) {
      filter.$or = [
        { title: { $regex: query.search.trim(), $options: 'i' } },
        { description: { $regex: query.search.trim(), $options: 'i' } },
      ];
    }

    if (query.type) {
      filter.type = query.type;
    }

    if (query.courseId) {
      if (role === 'student') {
        await this.coursePermissionService.getAccessibleCourse(
          query.courseId,
          userId,
          role,
          {
            notFoundMessage: '课程不存在',
            forbiddenMessage: '无权查看当前课程任务',
            notMemberMessage: '你未加入当前课程',
          },
        );
      } else {
        await this.assertCanManageCourse(query.courseId, userId, role);
      }
      filter.courseId = toObjectId(query.courseId);
    }

    if (role === 'student') {
      const memberships = await this.courseMemberModel.find(
        { userId: toObjectId(userId) },
        { courseId: 1 },
      );
      const courseIds = memberships.map((member) => member.courseId);
      const assignments = await this.taskAssignmentModel.find(
        { userId: toObjectId(userId) },
        { taskId: 1 },
      );

      filter.isPublished = true;
      andFilters.push({
        $or: [
          { assignmentMode: 'all', courseId: { $in: courseIds } },
          {
            assignmentMode: 'selected',
            _id: { $in: assignments.map((item) => item.taskId) },
          },
        ],
      });
    }

    if (role === 'teacher' && !query.courseId) {
      const teacherCourses = await this.courseModel.find(
        { teacherId: toObjectId(userId) },
        { _id: 1 },
      );
      filter.courseId = { $in: teacherCourses.map((course) => course._id) };
    }

    if (andFilters.length) {
      filter.$and = andFilters;
    }

    return filter;
  }

  private async toTaskItems(
    tasks: TaskDocument[],
    userId: string,
    role: UserRole,
  ): Promise<TaskItemDto[]> {
    if (!tasks.length) {
      return [];
    }

    const taskIds = tasks.map((task) => task._id);
    const courseIds = tasks.map((task) => task.courseId);

    const studentSubmissionDocs =
      role === 'student'
        ? await this.taskSubmissionModel.find({
            taskId: { $in: taskIds },
            userId: toObjectId(userId),
          })
        : [];

    const [assignmentCounts, submissionCounts, courseStudentCounts] =
      await Promise.all([
        this.taskAssignmentModel.aggregate<CountAggregation>([
          { $match: { taskId: { $in: taskIds } } },
          { $group: { _id: '$taskId', count: { $sum: 1 } } },
        ]),
        this.taskSubmissionModel.aggregate<SubmissionCountAggregation>([
          { $match: { taskId: { $in: taskIds } } },
          {
            $group: {
              _id: '$taskId',
              submittedCount: { $sum: 1 },
              gradedCount: {
                $sum: {
                  $cond: [{ $eq: ['$status', 'graded'] }, 1, 0],
                },
              },
            },
          },
        ]),
        this.courseMemberModel.aggregate<CountAggregation>([
          { $match: { courseId: { $in: courseIds } } },
          {
            $lookup: {
              from: 'users',
              localField: 'userId',
              foreignField: '_id',
              as: 'user',
            },
          },
          { $unwind: '$user' },
          { $match: { 'user.role': 'student' } },
          { $group: { _id: '$courseId', count: { $sum: 1 } } },
        ]),
      ]);

    const assignmentCountMap = new Map(
      assignmentCounts.map((item) => [item._id.toString(), item.count]),
    );
    const submissionCountMap = new Map(
      submissionCounts.map((item) => [
        item._id.toString(),
        {
          submittedCount: item.submittedCount,
          gradedCount: item.gradedCount,
        },
      ]),
    );
    const courseStudentCountMap = new Map(
      courseStudentCounts.map((item) => [item._id.toString(), item.count]),
    );
    const currentUserSubmissionMap = new Map<string, TaskSubmissionDocument>(
      studentSubmissionDocs.map((item): [string, TaskSubmissionDocument] => [
        item.taskId.toString(),
        item,
      ]),
    );

    return tasks.map((task) => {
      const course = this.toCourseBrief(task.courseId);
      const creator = this.toUserBrief(task.creatorId);
      const taskId = task._id.toString();
      const assignedStudentCount =
        task.assignmentMode === 'selected'
          ? (assignmentCountMap.get(taskId) ?? 0)
          : (courseStudentCountMap.get(course.id) ?? 0);
      const submissionStats = submissionCountMap.get(taskId) ?? {
        submittedCount: 0,
        gradedCount: 0,
      };
      const currentSubmission = currentUserSubmissionMap.get(taskId);

      return {
        id: taskId,
        courseId: course.id,
        title: task.title,
        description: task.description || undefined,
        type: task.type,
        dueDate: task.dueDate.toISOString(),
        totalScore: task.totalScore,
        passingScore: task.passingScore,
        attachments: this.toFileDtos(task.attachments),
        relatedResourceIds: task.relatedResourceIds.map((item) =>
          item.toString(),
        ),
        isPublished: task.isPublished,
        publishedAt: task.publishedAt ? task.publishedAt.toISOString() : null,
        assignmentMode: task.assignmentMode,
        creatorId: creator.id,
        assignedStudentCount,
        submittedCount: submissionStats.submittedCount,
        gradedCount: submissionStats.gradedCount,
        course,
        creator,
        currentUserSubmissionStatus: currentSubmission
          ? currentSubmission.status
          : role === 'student'
            ? 'not_submitted'
            : undefined,
        currentUserScore: currentSubmission?.score,
        createdAt: task.createdAt.toISOString(),
        updatedAt: task.updatedAt.toISOString(),
      };
    });
  }

  private async sanitizeTaskPayload(
    payload: Partial<CreateTaskDto>,
    courseId: string,
    options: { currentTask?: TaskDocument } = {},
  ) {
    const next: {
      title?: string;
      description?: string;
      type?: (typeof taskTypeValues)[number];
      dueDate?: Date;
      totalScore?: number;
      passingScore?: number;
      attachments?: TaskFile[];
      relatedResourceIds?: Types.ObjectId[];
      assignmentMode?: (typeof taskAssignmentModeValues)[number];
      assignedStudentIds?: string[];
      isPublished?: boolean;
      publishedAt?: Date | null;
    } = {};

    if (payload.title !== undefined) {
      const title = payload.title.trim();
      if (!title) {
        throw new AppException(
          '任务标题不能为空',
          ERROR_CODES.BAD_REQUEST,
          HttpStatus.BAD_REQUEST,
        );
      }
      next.title = title;
    }

    if (payload.description !== undefined) {
      next.description = payload.description.trim();
    }

    if (payload.type !== undefined) {
      next.type = payload.type;
    }

    if (payload.dueDate !== undefined) {
      const dueDate = new Date(payload.dueDate);
      if (Number.isNaN(dueDate.getTime())) {
        throw new AppException(
          '截止时间格式不正确',
          ERROR_CODES.BAD_REQUEST,
          HttpStatus.BAD_REQUEST,
        );
      }
      next.dueDate = dueDate;
    }

    if (payload.attachments !== undefined) {
      next.attachments = this.normalizeFiles(payload.attachments);
    }

    const finalType = next.type ?? options.currentTask?.type ?? 'project';
    next.totalScore = 100;
    next.passingScore = 60;
    const finalRelatedIds =
      payload.relatedResourceIds !== undefined
        ? payload.relatedResourceIds
        : options.currentTask?.relatedResourceIds.map((item) =>
            item.toString(),
          );
    next.relatedResourceIds = await this.normalizeRelatedResourceIds(
      courseId,
      finalType,
      finalRelatedIds,
    );

    const finalAssignmentMode =
      payload.assignmentMode ?? options.currentTask?.assignmentMode ?? 'all';
    next.assignmentMode = finalAssignmentMode;
    next.assignedStudentIds = await this.normalizeAssignedStudents(
      courseId,
      finalAssignmentMode,
      payload.assignedStudentIds,
      options.currentTask,
    );

    if (payload.isPublished !== undefined) {
      next.isPublished = payload.isPublished;
      next.publishedAt = payload.isPublished
        ? payload.publishedAt
          ? new Date(payload.publishedAt)
          : (options.currentTask?.publishedAt ?? new Date())
        : null;
    }

    return next;
  }

  private normalizeFiles(files: CreateTaskDto['attachments'] = []): TaskFile[] {
    return files.map((file) => ({
      key: file.key.trim(),
      url: file.url.trim(),
      originalName: file.originalName.trim(),
      size: file.size,
      mimeType: file.mimeType.trim(),
      name: file.name?.trim() || file.originalName.trim(),
    }));
  }

  private async normalizeRelatedResourceIds(
    courseId: string,
    type: (typeof taskTypeValues)[number],
    relatedResourceIds?: string[],
  ) {
    if (type !== 'reading') {
      return [];
    }

    const ids = [...new Set((relatedResourceIds ?? []).filter(Boolean))];
    if (!ids.length) {
      return [];
    }

    const resources = await this.courseResourceModel.find({
      _id: { $in: ids.map((id) => toObjectId(id)) },
      courseId: toObjectId(courseId),
    });

    if (resources.length !== ids.length) {
      throw new AppException(
        '存在不属于当前课程的关联资源',
        ERROR_CODES.BAD_REQUEST,
        HttpStatus.BAD_REQUEST,
      );
    }

    return ids.map((id) => toObjectId(id));
  }

  private async normalizeAssignedStudents(
    courseId: string,
    assignmentMode: (typeof taskAssignmentModeValues)[number],
    assignedStudentIds: string[] | undefined,
    currentTask?: TaskDocument,
  ) {
    if (assignmentMode !== 'selected') {
      return [];
    }

    const ids = [
      ...new Set(
        (
          assignedStudentIds ??
          (currentTask
            ? (
                await this.taskAssignmentModel.find(
                  { taskId: currentTask._id },
                  { userId: 1 },
                )
              ).map((item) => item.userId.toString())
            : [])
        ).filter(Boolean),
      ),
    ];

    if (!ids.length) {
      throw new AppException(
        '定向任务至少需要选择一名学生',
        ERROR_CODES.BAD_REQUEST,
        HttpStatus.BAD_REQUEST,
      );
    }

    const users = await this.userModel.find({
      _id: { $in: ids.map((id) => toObjectId(id)) },
      role: 'student',
    });
    if (users.length !== ids.length) {
      throw new AppException(
        '存在无效的学生账号',
        ERROR_CODES.BAD_REQUEST,
        HttpStatus.BAD_REQUEST,
      );
    }

    const members = await this.courseMemberModel.find({
      courseId: toObjectId(courseId),
      userId: { $in: ids.map((id) => toObjectId(id)) },
    });

    if (members.length !== ids.length) {
      throw new AppException(
        '存在未加入课程的学生',
        ERROR_CODES.BAD_REQUEST,
        HttpStatus.BAD_REQUEST,
      );
    }

    return ids;
  }

  private async replaceTaskAssignments(
    taskId: Types.ObjectId,
    assignmentMode: (typeof taskAssignmentModeValues)[number],
    assignedStudentIds: string[],
  ) {
    await this.taskAssignmentModel.deleteMany({ taskId });

    if (assignmentMode !== 'selected' || !assignedStudentIds.length) {
      return;
    }

    await this.taskAssignmentModel.insertMany(
      assignedStudentIds.map((studentId) => ({
        taskId,
        userId: toObjectId(studentId),
        assignedAt: new Date(),
      })),
    );
  }

  private async assertCanManageCourse(
    courseId: string,
    userId: string,
    role: UserRole,
  ) {
    await this.coursePermissionService.getManageableCourse(
      courseId,
      userId,
      role,
      {
        notFoundMessage: '课程不存在',
        forbiddenMessage: '无权管理当前课程任务',
        studentForbiddenMessage: '学生不能管理任务',
      },
    );
  }

  private toFileDtos(files: TaskFile[]) {
    return files.map((file) => ({
      key: file.key,
      url: file.url,
      originalName: file.originalName,
      size: file.size,
      mimeType: file.mimeType,
      name: file.name,
    }));
  }

  private toCourseBrief(
    rawCourse: TaskDocument['courseId'],
  ): TaskCourseBriefDto {
    if (rawCourse instanceof Types.ObjectId) {
      return { id: rawCourse.toString(), title: '' };
    }

    const course = rawCourse as Types.ObjectId & {
      _id?: Types.ObjectId;
      title?: string;
      courseCode?: string;
    };

    return {
      id: course._id?.toString() ?? '',
      title: course.title ?? '',
      courseCode: course.courseCode,
    };
  }

  private toUserBrief(rawUser: TaskDocument['creatorId']): TaskUserBriefDto {
    if (rawUser instanceof Types.ObjectId) {
      return { id: rawUser.toString(), username: '' };
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
