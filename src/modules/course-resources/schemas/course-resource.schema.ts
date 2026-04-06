import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type CourseResourceDocument = HydratedDocument<CourseResource>;

@Schema({
  timestamps: true,
  versionKey: false,
})
export class CourseResource {
  @Prop({
    type: Types.ObjectId,
    ref: 'Course',
    required: true,
    index: true,
  })
  courseId!: Types.ObjectId;

  @Prop({
    required: true,
    trim: true,
    maxlength: 100,
  })
  title!: string;

  @Prop({
    default: '',
    trim: true,
    maxlength: 500,
  })
  description!: string;

  @Prop({
    required: true,
    enum: ['document', 'video', 'image', 'other'],
  })
  type!: 'document' | 'video' | 'image' | 'other';

  @Prop({
    required: true,
    trim: true,
  })
  fileKey!: string;

  @Prop({
    required: true,
    trim: true,
  })
  fileUrl!: string;

  @Prop({
    required: true,
    trim: true,
    maxlength: 255,
  })
  originalFileName!: string;

  @Prop({
    required: true,
    trim: true,
    maxlength: 100,
  })
  mimeType!: string;

  @Prop({
    required: true,
    min: 1,
    max: 50 * 1024 * 1024,
  })
  size!: number;

  @Prop({
    type: Types.ObjectId,
    ref: 'User',
    required: true,
    index: true,
  })
  uploaderId!: Types.ObjectId;

  createdAt!: Date;
  updatedAt!: Date;
}

export const CourseResourceSchema =
  SchemaFactory.createForClass(CourseResource);

CourseResourceSchema.index({ courseId: 1, createdAt: -1 });
CourseResourceSchema.index({ courseId: 1, type: 1, createdAt: -1 });
