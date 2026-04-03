import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type CourseMemberDocument = HydratedDocument<CourseMember>;

@Schema({
  timestamps: true,
  versionKey: false,
})
export class CourseMember {
  @Prop({
    type: Types.ObjectId,
    ref: 'Course',
    required: true,
  })
  courseId!: Types.ObjectId;

  @Prop({
    type: Types.ObjectId,
    ref: 'User',
    required: true,
  })
  userId!: Types.ObjectId;

  @Prop({
    type: Date,
    default: Date.now,
  })
  joinDate!: Date;

  createdAt!: Date;
  updatedAt!: Date;
}

export const CourseMemberSchema = SchemaFactory.createForClass(CourseMember);

CourseMemberSchema.index({ courseId: 1, userId: 1 }, { unique: true });
CourseMemberSchema.index({ userId: 1, createdAt: -1 });
