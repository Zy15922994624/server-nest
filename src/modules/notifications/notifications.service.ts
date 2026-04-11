import { HttpStatus, Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { ERROR_CODES } from '../../common/constants/error-codes';
import { AppException } from '../../common/exceptions/app.exception';
import {
  readObjectId,
  toISOString,
  toISOStringOrNull,
  toObjectId,
} from '../../common/utils/model-value.util';
import { QueryNotificationsDto } from './dto/query-notifications.dto';
import type {
  NotificationItemDto,
  NotificationRelatedType,
  NotificationsPageDto,
  NotificationType,
  NotificationUnreadCountDto,
} from './interfaces/notification-response.interface';
import { NotificationsGateway } from './notifications.gateway';
import {
  Notification,
  type NotificationDocument,
} from './schemas/notification.schema';

interface CreateNotificationPayload {
  recipientId: string | Types.ObjectId;
  type: NotificationType;
  title: string;
  content: string;
  relatedId?: string | Types.ObjectId | null;
  relatedType?: NotificationRelatedType | null;
}

@Injectable()
export class NotificationsService {
  constructor(
    @InjectModel(Notification.name)
    private readonly notificationModel: Model<NotificationDocument>,
    private readonly notificationsGateway: NotificationsGateway,
  ) {}

  async createNotification(
    payload: CreateNotificationPayload,
  ): Promise<NotificationItemDto> {
    const notification = await this.notificationModel.create({
      recipientId: toObjectId(payload.recipientId),
      type: payload.type,
      title: payload.title.trim(),
      content: payload.content.trim(),
      relatedId: payload.relatedId ? toObjectId(payload.relatedId) : null,
      relatedType: payload.relatedType ?? null,
      isRead: false,
      readAt: null,
    });

    const dto = this.toNotificationDto(notification);
    this.notificationsGateway.emitNotificationToUser(dto.recipientId, dto);

    return dto;
  }

  async getNotifications(
    recipientId: string,
    query: QueryNotificationsDto,
  ): Promise<NotificationsPageDto> {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 20;
    const filter: Record<string, unknown> = {
      recipientId: toObjectId(recipientId),
    };

    if (query.type) {
      filter.type = query.type;
    }

    if (query.isRead !== undefined) {
      filter.isRead = query.isRead;
    }

    const [items, total] = await Promise.all([
      this.notificationModel
        .find(filter)
        .sort({ createdAt: -1 })
        .skip((page - 1) * pageSize)
        .limit(pageSize),
      this.notificationModel.countDocuments(filter),
    ]);

    return {
      items: items.map((item) => this.toNotificationDto(item)),
      total,
    };
  }

  async getUnreadCount(
    recipientId: string,
  ): Promise<NotificationUnreadCountDto> {
    const unreadCount = await this.notificationModel.countDocuments({
      recipientId: toObjectId(recipientId),
      isRead: false,
    });

    return { unreadCount };
  }

  async markAsRead(notificationId: string, recipientId: string): Promise<void> {
    const updated = await this.notificationModel.findOneAndUpdate(
      {
        _id: toObjectId(notificationId),
        recipientId: toObjectId(recipientId),
        isRead: false,
      },
      {
        isRead: true,
        readAt: new Date(),
      },
      { new: true },
    );

    if (!updated) {
      throw new AppException(
        '通知不存在或已读',
        ERROR_CODES.NOT_FOUND,
        HttpStatus.NOT_FOUND,
      );
    }
  }

  async markAllAsRead(recipientId: string): Promise<number> {
    const result = await this.notificationModel.updateMany(
      {
        recipientId: toObjectId(recipientId),
        isRead: false,
      },
      {
        isRead: true,
        readAt: new Date(),
      },
    );

    return result.modifiedCount;
  }

  async deleteNotification(
    notificationId: string,
    recipientId: string,
  ): Promise<void> {
    const result = await this.notificationModel.deleteOne({
      _id: toObjectId(notificationId),
      recipientId: toObjectId(recipientId),
    });

    if (!result.deletedCount) {
      throw new AppException(
        '通知不存在',
        ERROR_CODES.NOT_FOUND,
        HttpStatus.NOT_FOUND,
      );
    }
  }

  async checkNotificationExists(
    recipientId: string | Types.ObjectId,
    type: NotificationType,
    relatedId?: string | Types.ObjectId,
  ): Promise<boolean> {
    const filter: Record<string, unknown> = {
      recipientId: toObjectId(recipientId),
      type,
    };

    if (relatedId) {
      filter.relatedId = toObjectId(relatedId);
    }

    const count = await this.notificationModel.countDocuments(filter);
    return count > 0;
  }

  async deleteByTaskIds(
    taskIds: Array<string | Types.ObjectId>,
  ): Promise<void> {
    if (!taskIds.length) {
      return;
    }

    await this.notificationModel.deleteMany({
      relatedType: 'task',
      relatedId: {
        $in: taskIds.map((taskId) => toObjectId(taskId)),
      },
    });
  }

  private toNotificationDto(
    notification: NotificationDocument,
  ): NotificationItemDto {
    return {
      id: readObjectId(notification._id),
      recipientId: readObjectId(notification.recipientId),
      type: notification.type,
      title: notification.title,
      content: notification.content,
      relatedId: notification.relatedId
        ? readObjectId(notification.relatedId)
        : null,
      relatedType: notification.relatedType ?? null,
      isRead: notification.isRead,
      readAt: toISOStringOrNull(notification.readAt),
      createdAt: toISOString(notification.createdAt),
      updatedAt: toISOString(notification.updatedAt),
    };
  }
}
