import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type CourseDiscussionReplyDocument =
  HydratedDocument<CourseDiscussionReply>;
export type CourseDiscussionDocument = HydratedDocument<CourseDiscussion>;

@Schema({
  _id: true,
  timestamps: true,
  versionKey: false,
})
export class CourseDiscussionReply {
  @Prop({
    required: true,
    trim: true,
    maxlength: 2000,
  })
  content!: string;

  @Prop({
    type: Types.ObjectId,
    ref: 'User',
    required: true,
    index: true,
  })
  authorId!: Types.ObjectId;

  createdAt!: Date;
  updatedAt!: Date;
}

export const CourseDiscussionReplySchema = SchemaFactory.createForClass(
  CourseDiscussionReply,
);

@Schema({
  timestamps: true,
  versionKey: false,
})
export class CourseDiscussion {
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
    maxlength: 120,
  })
  title!: string;

  @Prop({
    required: true,
    trim: true,
    maxlength: 5000,
  })
  content!: string;

  @Prop({
    type: Types.ObjectId,
    ref: 'User',
    required: true,
    index: true,
  })
  authorId!: Types.ObjectId;

  @Prop({
    type: [CourseDiscussionReplySchema],
    default: [],
  })
  replies!: Types.DocumentArray<CourseDiscussionReply>;

  createdAt!: Date;
  updatedAt!: Date;
}

export const CourseDiscussionSchema =
  SchemaFactory.createForClass(CourseDiscussion);

CourseDiscussionSchema.index({ courseId: 1, createdAt: -1 });
CourseDiscussionSchema.index({ courseId: 1, authorId: 1, createdAt: -1 });
