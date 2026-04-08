import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type TaskAssignmentDocument = HydratedDocument<TaskAssignment>;

@Schema({
  timestamps: true,
  versionKey: false,
})
export class TaskAssignment {
  @Prop({ type: Types.ObjectId, ref: 'Task', required: true, index: true })
  taskId!: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'User', required: true, index: true })
  userId!: Types.ObjectId;

  @Prop({ required: true, default: Date.now })
  assignedAt!: Date;

  createdAt!: Date;
  updatedAt!: Date;
}

export const TaskAssignmentSchema =
  SchemaFactory.createForClass(TaskAssignment);

TaskAssignmentSchema.index({ taskId: 1, userId: 1 }, { unique: true });
