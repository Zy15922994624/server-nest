import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Schema as MongooseSchema, Types } from 'mongoose';

export type TaskQuestionDocument = HydratedDocument<TaskQuestion>;
export type TaskQuestionType =
  | 'single_choice'
  | 'multi_choice'
  | 'fill_text'
  | 'rich_text';

@Schema({ _id: false, versionKey: false })
export class TaskQuestionOption {
  @Prop({ required: true, trim: true, maxlength: 20 })
  key!: string;

  @Prop({ required: true, trim: true, maxlength: 200 })
  label!: string;
}

export const TaskQuestionOptionSchema =
  SchemaFactory.createForClass(TaskQuestionOption);

@Schema({
  timestamps: true,
  versionKey: false,
})
export class TaskQuestion {
  @Prop({ type: Types.ObjectId, ref: 'Task', required: true, index: true })
  taskId!: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'QuestionBank', index: true })
  questionBankId?: Types.ObjectId;

  @Prop({
    required: true,
    enum: ['single_choice', 'multi_choice', 'fill_text', 'rich_text'],
  })
  type!: TaskQuestionType;

  @Prop({ required: true, trim: true, maxlength: 1000 })
  title!: string;

  @Prop({ default: '', trim: true, maxlength: 2000 })
  description!: string;

  @Prop({ type: [TaskQuestionOptionSchema], default: [] })
  options!: TaskQuestionOption[];

  @Prop({ type: MongooseSchema.Types.Mixed })
  answer?: unknown;

  @Prop({ required: true, min: 0, max: 1000 })
  score!: number;

  @Prop({ required: true, min: 0, index: true })
  order!: number;

  @Prop({ default: '', trim: true, maxlength: 4000 })
  analysis!: string;

  @Prop({ min: 1 })
  bankVersion?: number;

  createdAt!: Date;
  updatedAt!: Date;
}

export const TaskQuestionSchema = SchemaFactory.createForClass(TaskQuestion);
TaskQuestionSchema.index({ taskId: 1, order: 1 });
TaskQuestionSchema.index(
  { taskId: 1, questionBankId: 1 },
  { unique: true, sparse: true },
);
