import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type TaskDocument = HydratedDocument<Task>;
export type TaskType = 'homework' | 'quiz' | 'project' | 'reading';
export type TaskAssignmentMode = 'all' | 'selected';

@Schema({ _id: false, versionKey: false })
export class TaskFile {
  @Prop({ required: true, trim: true })
  key!: string;

  @Prop({ required: true, trim: true })
  url!: string;

  @Prop({ required: true, trim: true, maxlength: 255 })
  originalName!: string;

  @Prop({ required: true, min: 1, max: 50 * 1024 * 1024 })
  size!: number;

  @Prop({ required: true, trim: true, maxlength: 100 })
  mimeType!: string;

  @Prop({ trim: true, maxlength: 255 })
  name?: string;
}

export const TaskFileSchema = SchemaFactory.createForClass(TaskFile);

@Schema({
  timestamps: true,
  versionKey: false,
})
export class Task {
  @Prop({ type: Types.ObjectId, ref: 'Course', required: true, index: true })
  courseId!: Types.ObjectId;

  @Prop({ required: true, trim: true, maxlength: 100 })
  title!: string;

  @Prop({ default: '', trim: true, maxlength: 4000 })
  description!: string;

  @Prop({
    required: true,
    enum: ['homework', 'quiz', 'project', 'reading'],
  })
  type!: TaskType;

  @Prop({ required: true })
  dueDate!: Date;

  @Prop({ required: true, default: 100, min: 0, max: 1000 })
  totalScore!: number;

  @Prop({ required: true, default: 60, min: 0, max: 1000 })
  passingScore!: number;

  @Prop({ type: [TaskFileSchema], default: [] })
  attachments!: TaskFile[];

  @Prop({
    type: [{ type: Types.ObjectId, ref: 'CourseResource' }],
    default: [],
  })
  relatedResourceIds!: Types.ObjectId[];

  @Prop({ required: true, default: true, index: true })
  isPublished!: boolean;

  @Prop({ type: Date, default: null })
  publishedAt!: Date | null;

  @Prop({
    required: true,
    enum: ['all', 'selected'],
    default: 'all',
    index: true,
  })
  assignmentMode!: TaskAssignmentMode;

  @Prop({ type: Types.ObjectId, ref: 'User', required: true, index: true })
  creatorId!: Types.ObjectId;

  createdAt!: Date;
  updatedAt!: Date;
}

export const TaskSchema = SchemaFactory.createForClass(Task);
TaskSchema.index({ courseId: 1, createdAt: -1 });
TaskSchema.index({ creatorId: 1, createdAt: -1 });
TaskSchema.index({ dueDate: 1 });
