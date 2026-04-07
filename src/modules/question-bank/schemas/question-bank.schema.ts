import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Schema as MongooseSchema, Types } from 'mongoose';

export type QuestionBankDocument = HydratedDocument<QuestionBank>;
export type QuestionType =
  | 'single_choice'
  | 'multi_choice'
  | 'fill_text'
  | 'rich_text';

@Schema({ _id: false, versionKey: false })
export class QuestionOption {
  @Prop({ required: true, trim: true, maxlength: 20 })
  key!: string;

  @Prop({ required: true, trim: true, maxlength: 200 })
  label!: string;
}

export const QuestionOptionSchema =
  SchemaFactory.createForClass(QuestionOption);

@Schema({
  timestamps: true,
  versionKey: false,
})
export class QuestionBank {
  @Prop({ type: Types.ObjectId, ref: 'Course', required: true, index: true })
  courseId!: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'User', required: true, index: true })
  ownerId!: Types.ObjectId;

  @Prop({ required: true, trim: true, maxlength: 1000 })
  title!: string;

  @Prop({ default: '', trim: true, maxlength: 2000 })
  description!: string;

  @Prop({
    required: true,
    enum: ['single_choice', 'multi_choice', 'fill_text', 'rich_text'],
  })
  type!: QuestionType;

  @Prop({ type: [QuestionOptionSchema], default: [] })
  options!: QuestionOption[];

  @Prop({ type: MongooseSchema.Types.Mixed, required: true })
  answer!: unknown;

  @Prop({ default: '', trim: true, maxlength: 4000 })
  analysis!: string;

  @Prop({ required: true, min: 0, max: 1000 })
  score!: number;

  @Prop({ default: 1, min: 1 })
  version!: number;

  @Prop({ default: 0, min: 0 })
  useCount!: number;

  createdAt!: Date;
  updatedAt!: Date;
}

export const QuestionBankSchema = SchemaFactory.createForClass(QuestionBank);
QuestionBankSchema.index({ courseId: 1, updatedAt: -1 });
QuestionBankSchema.index({ courseId: 1, type: 1, updatedAt: -1 });
QuestionBankSchema.index({ ownerId: 1, updatedAt: -1 });
