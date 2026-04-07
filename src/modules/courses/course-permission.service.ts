import { HttpStatus, Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { ERROR_CODES } from '../../common/constants/error-codes';
import { AppException } from '../../common/exceptions/app.exception';
import type { UserRole } from '../../common/interfaces/auth-user.interface';
import { toObjectId } from '../../common/utils/model-value.util';
import {
  CourseMember,
  CourseMemberDocument,
} from './schemas/course-member.schema';
import { Course, CourseDocument } from './schemas/course.schema';

interface CourseAccessOptions {
  notFoundMessage?: string;
  forbiddenMessage?: string;
  studentForbiddenMessage?: string;
  notMemberMessage?: string;
}

@Injectable()
export class CoursePermissionService {
  constructor(
    @InjectModel(Course.name)
    private readonly courseModel: Model<CourseDocument>,
    @InjectModel(CourseMember.name)
    private readonly courseMemberModel: Model<CourseMemberDocument>,
  ) {}

  async getAccessibleCourse(
    courseId: string | Types.ObjectId,
    userId: string,
    role: UserRole,
    options: CourseAccessOptions = {},
  ): Promise<CourseDocument> {
    const targetCourseId = toObjectId(courseId);
    const course = await this.courseModel.findById(targetCourseId);

    if (!course) {
      throw new AppException(
        options.notFoundMessage ?? '课程不存在',
        ERROR_CODES.NOT_FOUND,
        HttpStatus.NOT_FOUND,
      );
    }

    if (role === 'admin') {
      return course;
    }

    if (role === 'teacher') {
      if (course.teacherId.toString() === userId) {
        return course;
      }

      throw new AppException(
        options.forbiddenMessage ?? '无权访问当前课程',
        ERROR_CODES.FORBIDDEN,
        HttpStatus.FORBIDDEN,
      );
    }

    const membership = await this.courseMemberModel.exists({
      courseId: targetCourseId,
      userId: toObjectId(userId),
    });

    if (membership) {
      return course;
    }

    throw new AppException(
      options.notMemberMessage ?? '你未加入该课程',
      ERROR_CODES.FORBIDDEN,
      HttpStatus.FORBIDDEN,
    );
  }

  async getManageableCourse(
    courseId: string | Types.ObjectId,
    userId: string,
    role: UserRole,
    options: CourseAccessOptions = {},
  ): Promise<CourseDocument> {
    if (role === 'student') {
      throw new AppException(
        options.studentForbiddenMessage ?? '学生不能管理当前课程',
        ERROR_CODES.FORBIDDEN,
        HttpStatus.FORBIDDEN,
      );
    }

    return this.getAccessibleCourse(courseId, userId, role, {
      notFoundMessage: options.notFoundMessage,
      forbiddenMessage: options.forbiddenMessage,
      notMemberMessage: options.notMemberMessage,
    });
  }

  async assertStudentMember(
    courseId: string | Types.ObjectId,
    userId: string,
    message = '你未加入该课程',
  ): Promise<void> {
    const membership = await this.courseMemberModel.exists({
      courseId: toObjectId(courseId),
      userId: toObjectId(userId),
    });

    if (!membership) {
      throw new AppException(
        message,
        ERROR_CODES.FORBIDDEN,
        HttpStatus.FORBIDDEN,
      );
    }
  }
}
