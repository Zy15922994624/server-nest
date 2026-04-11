import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';
import type {
  NotificationRelatedType,
  NotificationType,
} from '../interfaces/notification-response.interface';

export type NotificationDocument = HydratedDocument<Notification>;

@Schema({
  timestamps: true,
  versionKey: false,
})
export class Notification {
  @Prop({ type: Types.ObjectId, ref: 'User', required: true, index: true })
  recipientId!: Types.ObjectId;

  @Prop({
    required: true,
    enum: ['task_due_soon', 'task_overdue', 'task_graded'],
  })
  type!: NotificationType;

  @Prop({ required: true, trim: true, maxlength: 100 })
  title!: string;

  @Prop({ required: true, trim: true, maxlength: 500 })
  content!: string;

  @Prop({ type: Types.ObjectId, default: null })
  relatedId!: Types.ObjectId | null;

  @Prop({
    type: String,
    default: null,
    enum: ['task', 'course', 'submission', null],
  })
  relatedType!: NotificationRelatedType | null;

  @Prop({ type: Boolean, default: false })
  isRead!: boolean;

  @Prop({ type: Date, default: null })
  readAt!: Date | null;

  createdAt!: Date;
  updatedAt!: Date;
}

export const NotificationSchema = SchemaFactory.createForClass(Notification);

NotificationSchema.index({ recipientId: 1, isRead: 1, createdAt: -1 });
NotificationSchema.index({ recipientId: 1, type: 1 });
