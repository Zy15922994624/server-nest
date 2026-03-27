import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';
import type { UserRole } from '../../../common/interfaces/auth-user.interface';

export type UserDocument = HydratedDocument<User>;

@Schema({
  timestamps: true,
  versionKey: false,
})
export class User {
  @Prop({
    required: true,
    unique: true,
    trim: true,
    minlength: 3,
    maxlength: 30,
  })
  username: string;

  @Prop({
    required: true,
    select: false,
  })
  password: string;

  @Prop({
    required: true,
    unique: true,
    lowercase: true,
    trim: true,
  })
  email: string;

  @Prop({
    type: String,
    enum: ['student', 'teacher', 'admin'],
    default: 'student',
    required: true,
  })
  role: UserRole;

  @Prop({
    default: '',
    trim: true,
    maxlength: 50,
  })
  fullName?: string;

  @Prop({
    default: '',
    trim: true,
  })
  avatar?: string;

  createdAt: Date;
  updatedAt: Date;
}

export const UserSchema = SchemaFactory.createForClass(User);

UserSchema.index({ username: 1 }, { unique: true });
UserSchema.index({ email: 1 }, { unique: true });
UserSchema.index({ role: 1 });
