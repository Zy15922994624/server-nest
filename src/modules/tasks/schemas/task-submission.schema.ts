import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';
import { TaskFile, TaskFileSchema } from './task.schema';

export type TaskSubmissionDocument = HydratedDocument<TaskSubmission>;
export type TaskSubmissionStatus = 'submitted' | 'graded';

@Schema({
  timestamps: true,
  versionKey: false,
})
export class TaskSubmission {
  @Prop({ type: Types.ObjectId, ref: 'Task', required: true, index: true })
  taskId!: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'User', required: true, index: true })
  userId!: Types.ObjectId;

  @Prop({ default: '', trim: true, maxlength: 10000 })
  content!: string;

  @Prop({ type: [TaskFileSchema], default: [] })
  attachments!: TaskFile[];

  @Prop({ required: true, default: Date.now })
  submittedAt!: Date;

  @Prop({
    required: true,
    enum: ['submitted', 'graded'],
    default: 'submitted',
    index: true,
  })
  status!: TaskSubmissionStatus;

  @Prop({ min: 0, max: 1000 })
  score?: number;

  @Prop({ required: true, default: 100, min: 0, max: 1000 })
  maxScore!: number;

  @Prop({ default: '', trim: true, maxlength: 4000 })
  feedback!: string;

  @Prop({ type: Types.ObjectId, ref: 'User' })
  gradedBy?: Types.ObjectId;

  @Prop({ type: Date, default: null })
  gradedAt!: Date | null;

  createdAt!: Date;
  updatedAt!: Date;
}

export const TaskSubmissionSchema =
  SchemaFactory.createForClass(TaskSubmission);

TaskSubmissionSchema.index({ taskId: 1, userId: 1 }, { unique: true });
TaskSubmissionSchema.index({ taskId: 1, status: 1, submittedAt: -1 });
