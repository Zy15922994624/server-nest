import { HttpStatus, Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { ERROR_CODES } from '../../common/constants/error-codes';
import { AppException } from '../../common/exceptions/app.exception';
import type { UserRole } from '../../common/interfaces/auth-user.interface';
import { toObjectId } from '../../common/utils/model-value.util';
import { CoursePermissionService } from '../courses/course-permission.service';
import {
  TaskAssignment,
  TaskAssignmentDocument,
} from './schemas/task-assignment.schema';
import { Task, TaskDocument } from './schemas/task.schema';

@Injectable()
export class TaskPermissionService {
  constructor(
    @InjectModel(Task.name)
    private readonly taskModel: Model<TaskDocument>,
    @InjectModel(TaskAssignment.name)
    private readonly taskAssignmentModel: Model<TaskAssignmentDocument>,
    private readonly coursePermissionService: CoursePermissionService,
  ) {}

  async getReadableTask(
    taskId: string,
    userId: string,
    role: UserRole,
  ): Promise<TaskDocument> {
    const task = await this.taskModel.findById(toObjectId(taskId));

    if (!task) {
      throw new AppException(
        '任务不存在',
        ERROR_CODES.NOT_FOUND,
        HttpStatus.NOT_FOUND,
      );
    }

    if (role === 'admin') {
      return task;
    }

    if (role === 'teacher') {
      await this.coursePermissionService.getManageableCourse(
        task.courseId,
        userId,
        role,
        {
          notFoundMessage: '任务不存在',
          forbiddenMessage: '无权访问当前任务',
          studentForbiddenMessage: '学生不能管理任务',
        },
      );
      return task;
    }

    await this.coursePermissionService.getAccessibleCourse(
      task.courseId,
      userId,
      role,
      {
        notFoundMessage: '任务不存在',
        forbiddenMessage: '无权访问当前任务',
        notMemberMessage: '你未加入当前课程',
      },
    );

    if (!task.isPublished) {
      throw new AppException(
        '任务暂未发布',
        ERROR_CODES.FORBIDDEN,
        HttpStatus.FORBIDDEN,
      );
    }

    if (task.assignmentMode === 'selected') {
      const assigned = await this.taskAssignmentModel.exists({
        taskId: task._id,
        userId: toObjectId(userId),
      });

      if (!assigned) {
        throw new AppException(
          '该任务仅对指定学生开放',
          ERROR_CODES.FORBIDDEN,
          HttpStatus.FORBIDDEN,
        );
      }
    }

    return task;
  }

  async getManageableTask(
    taskId: string,
    userId: string,
    role: UserRole,
  ): Promise<TaskDocument> {
    if (role === 'student') {
      throw new AppException(
        '学生不能管理任务',
        ERROR_CODES.FORBIDDEN,
        HttpStatus.FORBIDDEN,
      );
    }

    const task = await this.taskModel.findById(toObjectId(taskId));

    if (!task) {
      throw new AppException(
        '任务不存在',
        ERROR_CODES.NOT_FOUND,
        HttpStatus.NOT_FOUND,
      );
    }

    await this.coursePermissionService.getManageableCourse(
      task.courseId,
      userId,
      role,
      {
        notFoundMessage: '任务不存在',
        forbiddenMessage: '无权管理当前任务',
        studentForbiddenMessage: '学生不能管理任务',
      },
    );

    return task;
  }
}
