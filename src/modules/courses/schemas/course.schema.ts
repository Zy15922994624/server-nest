import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type CourseDocument = HydratedDocument<Course>;

@Schema({
  timestamps: true,
  versionKey: false,
})
export class Course {
  @Prop({
    required: true,
    trim: true,
    maxlength: 100,
  })
  title: string;

  @Prop({
    default: '',
    maxlength: 1000,
  })
  description: string;

  @Prop({
    unique: true,
    sparse: true,
    uppercase: true,
    trim: true,
    match: /^[A-Z]{2}\d{3}$/,
  })
  courseCode?: string;

  @Prop({
    default: '',
  })
  coverImage?: string;

  @Prop({
    default: '',
    maxlength: 50,
  })
  semester?: string;

  @Prop({
    type: Number,
    min: 0,
    max: 20,
    default: 0,
  })
  credits: number;

  @Prop({
    type: Number,
    min: 1,
    max: 500,
    default: null,
  })
  maxStudents: number | null;

  @Prop({
    type: Types.ObjectId,
    ref: 'User',
    required: true,
  })
  teacherId: Types.ObjectId;

  @Prop({
    default: false,
  })
  isArchived: boolean;

  @Prop({
    type: Date,
    default: null,
  })
  archivedAt: Date | null;

  createdAt: Date;
  updatedAt: Date;
}

export const CourseSchema = SchemaFactory.createForClass(Course);

CourseSchema.index({ teacherId: 1 });
CourseSchema.index({ isArchived: 1 });
CourseSchema.index({ teacherId: 1, createdAt: -1 });
