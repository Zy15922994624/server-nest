import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Schema as MongooseSchema, Types } from 'mongoose';
import { TaskFile, TaskFileSchema } from './task.schema';

export type TaskSubmissionDocument = HydratedDocument<TaskSubmission>;
export type TaskSubmissionStatus = 'submitted' | 'graded';

@Schema({ _id: false, versionKey: false })
export class TaskSubmissionAnswer {
  @Prop({ type: Types.ObjectId, ref: 'TaskQuestion', required: true })
  questionId!: Types.ObjectId;

  @Prop({ type: MongooseSchema.Types.Mixed, default: null })
  answer!: unknown;

  @Prop({ required: true, default: 0, min: 0, max: 1000 })
  autoScore!: number;

  @Prop({ type: Number, default: null, min: 0, max: 1000 })
  manualScore!: number | null;

  @Prop({ default: '', trim: true, maxlength: 2000 })
  comments!: string;
}

export const TaskSubmissionAnswerSchema =
  SchemaFactory.createForClass(TaskSubmissionAnswer);

@Schema({ _id: false, versionKey: false })
export class TaskSubmissionRevision {
  @Prop({ type: Types.ObjectId, ref: 'User' })
  gradedBy?: Types.ObjectId;

  @Prop({ required: true, min: 0, max: 1000 })
  score!: number;

  @Prop({ default: '', trim: true, maxlength: 4000 })
  feedback!: string;

  @Prop({ type: Date, required: true, default: Date.now })
  gradedAt!: Date;
}

export const TaskSubmissionRevisionSchema = SchemaFactory.createForClass(
  TaskSubmissionRevision,
);

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

  @Prop({ type: [TaskSubmissionAnswerSchema], default: [] })
  answers!: TaskSubmissionAnswer[];

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

  @Prop({ type: [TaskSubmissionRevisionSchema], default: [] })
  revisionHistory!: TaskSubmissionRevision[];

  createdAt!: Date;
  updatedAt!: Date;
}

export const TaskSubmissionSchema =
  SchemaFactory.createForClass(TaskSubmission);

TaskSubmissionSchema.index({ taskId: 1, userId: 1 }, { unique: true });
TaskSubmissionSchema.index({ taskId: 1, status: 1, submittedAt: -1 });
