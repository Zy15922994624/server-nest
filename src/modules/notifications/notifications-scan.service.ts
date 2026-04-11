import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import type { UserRole } from '../../common/interfaces/auth-user.interface';
import { readObjectId } from '../../common/utils/model-value.util';
import {
  CourseMember,
  type CourseMemberDocument,
} from '../courses/schemas/course-member.schema';
import { User, type UserDocument } from '../users/schemas/user.schema';
import {
  TaskAssignment,
  type TaskAssignmentDocument,
} from '../tasks/schemas/task-assignment.schema';
import { Task, type TaskDocument } from '../tasks/schemas/task.schema';
import type { NotificationScanResultDto } from './interfaces/notification-response.interface';
import { NotificationsService } from './notifications.service';

type ScanTaskRecord = Pick<
  TaskDocument,
  '_id' | 'title' | 'dueDate' | 'courseId' | 'assignmentMode'
>;

@Injectable()
export class NotificationsScanService implements OnModuleInit {
  private readonly logger = new Logger(NotificationsScanService.name);

  constructor(
    @InjectModel(Task.name)
    private readonly taskModel: Model<TaskDocument>,
    @InjectModel(TaskAssignment.name)
    private readonly taskAssignmentModel: Model<TaskAssignmentDocument>,
    @InjectModel(CourseMember.name)
    private readonly courseMemberModel: Model<CourseMemberDocument>,
    @InjectModel(User.name)
    private readonly userModel: Model<UserDocument>,
    private readonly notificationsService: NotificationsService,
  ) {}

  async onModuleInit() {
    try {
      await this.scanTasksForNotifications();
    } catch (error) {
      this.logger.error('初始化任务通知扫描失败', error);
    }
  }

  @Cron(CronExpression.EVERY_HOUR)
  async handleHourlyScan() {
    await this.scanTasksForNotifications();
  }

  async scanTasksForNotifications(): Promise<NotificationScanResultDto> {
    const now = new Date();
    const threeDaysLater = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000);

    const [dueSoonCreated, overdueCreated] = await Promise.all([
      this.scanDueSoonTasks(now, threeDaysLater),
      this.scanOverdueTasks(now),
    ]);

    this.logger.log(
      `任务通知扫描完成：即将截止 ${dueSoonCreated} 条，已过期 ${overdueCreated} 条`,
    );

    return {
      dueSoonCreated,
      overdueCreated,
    };
  }

  private async scanDueSoonTasks(
    now: Date,
    threeDaysLater: Date,
  ): Promise<number> {
    const tasks = await this.taskModel
      .find({
        dueDate: {
          $gte: now,
          $lte: threeDaysLater,
        },
        isPublished: true,
      })
      .select('_id title dueDate courseId assignmentMode');

    let createdCount = 0;

    for (const task of tasks) {
      const recipients = await this.getTaskRecipientIds(task);

      for (const recipientId of recipients) {
        const exists = await this.notificationsService.checkNotificationExists(
          recipientId,
          'task_due_soon',
          task._id,
        );

        if (exists) {
          continue;
        }

        await this.notificationsService.createNotification({
          recipientId,
          type: 'task_due_soon',
          title: '任务即将截止',
          content: `任务“${task.title}”将于 ${this.formatDate(task.dueDate)} 截止，请尽快完成。`,
          relatedId: task._id,
          relatedType: 'task',
        });
        createdCount += 1;
      }
    }

    return createdCount;
  }

  private async scanOverdueTasks(now: Date): Promise<number> {
    const tasks = await this.taskModel
      .find({
        dueDate: { $lt: now },
        isPublished: true,
      })
      .select('_id title dueDate courseId assignmentMode');

    let createdCount = 0;

    for (const task of tasks) {
      const recipients = await this.getTaskRecipientIds(task);

      for (const recipientId of recipients) {
        const exists = await this.notificationsService.checkNotificationExists(
          recipientId,
          'task_overdue',
          task._id,
        );

        if (exists) {
          continue;
        }

        await this.notificationsService.createNotification({
          recipientId,
          type: 'task_overdue',
          title: '任务已过期',
          content: `任务“${task.title}”已超过截止时间，请及时与教师确认后续安排。`,
          relatedId: task._id,
          relatedType: 'task',
        });
        createdCount += 1;
      }
    }

    return createdCount;
  }

  private async getTaskRecipientIds(task: ScanTaskRecord): Promise<string[]> {
    if (task.assignmentMode === 'selected') {
      const assignments = await this.taskAssignmentModel
        .find({ taskId: task._id })
        .select('userId')
        .lean();

      return [
        ...new Set(
          assignments.map((item) => readObjectId(item.userId)).filter(Boolean),
        ),
      ];
    }

    const members = await this.courseMemberModel
      .find({ courseId: task.courseId })
      .select('userId')
      .lean();

    const userIds = members
      .map((item) => item.userId)
      .filter((item): item is Types.ObjectId => Boolean(item));

    if (!userIds.length) {
      return [];
    }

    const students = await this.userModel
      .find({
        _id: { $in: userIds },
        role: 'student' as UserRole,
      })
      .select('_id')
      .lean();

    return students.map((item) => readObjectId(item._id)).filter(Boolean);
  }

  private formatDate(value: Date): string {
    const year = value.getFullYear();
    const month = String(value.getMonth() + 1).padStart(2, '0');
    const day = String(value.getDate()).padStart(2, '0');
    const hour = String(value.getHours()).padStart(2, '0');
    const minute = String(value.getMinutes()).padStart(2, '0');

    return `${year}-${month}-${day} ${hour}:${minute}`;
  }
}
