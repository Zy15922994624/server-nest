import { HttpStatus, Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { ERROR_CODES } from '../../common/constants/error-codes';
import { AppException } from '../../common/exceptions/app.exception';
import { readObjectId, toObjectId } from '../../common/utils/model-value.util';
import type { UserRole } from '../../common/interfaces/auth-user.interface';
import { CoursePermissionService } from '../courses/course-permission.service';
import { Course, CourseDocument } from '../courses/schemas/course.schema';
import { CreateCourseDiscussionReplyDto } from './dto/create-course-discussion-reply.dto';
import { CreateCourseDiscussionDto } from './dto/create-course-discussion.dto';
import { QueryCourseDiscussionRepliesDto } from './dto/query-course-discussion-replies.dto';
import { QueryCourseDiscussionsDto } from './dto/query-course-discussions.dto';
import {
  CourseDiscussionAuthorDto,
  CourseDiscussionDetailDto,
  CourseDiscussionListItemDto,
  CourseDiscussionReplyDto,
  CourseDiscussionsPageDto,
  CourseDiscussionRepliesPageDto,
} from './interfaces/course-discussion-response.interface';
import {
  CourseDiscussion,
  CourseDiscussionDocument,
} from './schemas/course-discussion.schema';

type UserReference = Types.ObjectId | Record<string, unknown>;
type DiscussionListAggregation = {
  _id: Types.ObjectId;
  courseId: Types.ObjectId;
  title: string;
  content: string;
  authorId: Types.ObjectId;
  author?: {
    _id?: Types.ObjectId;
    username?: string;
    fullName?: string;
  };
  replyCount?: number;
  lastReplyAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
};

type DiscussionRepliesAggregation = {
  items: Array<{
    _id?: Types.ObjectId;
    content: string;
    authorId: Types.ObjectId | Record<string, unknown>;
    author?: {
      _id?: Types.ObjectId;
      username?: string;
      fullName?: string;
    };
    createdAt: Date;
    updatedAt: Date;
  }>;
  total: Array<{ count: number }>;
};

@Injectable()
export class CourseDiscussionsService {
  constructor(
    @InjectModel(CourseDiscussion.name)
    private readonly courseDiscussionModel: Model<CourseDiscussionDocument>,
    @InjectModel(Course.name)
    private readonly courseModel: Model<CourseDocument>,
    private readonly coursePermissionService: CoursePermissionService,
  ) {}

  async getDiscussions(
    courseId: string,
    userId: string,
    role: UserRole,
    query: QueryCourseDiscussionsDto,
  ): Promise<CourseDiscussionsPageDto> {
    await this.assertCanAccessCourse(courseId, userId, role);

    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 10;
    const skip = (page - 1) * pageSize;
    const filter = this.buildDiscussionFilter(courseId, query);

    const [items, total] = await Promise.all([
      this.courseDiscussionModel.aggregate<DiscussionListAggregation>([
        { $match: filter },
        { $sort: { updatedAt: -1, createdAt: -1 } },
        { $skip: skip },
        { $limit: pageSize },
        {
          $lookup: {
            from: 'users',
            localField: 'authorId',
            foreignField: '_id',
            as: 'author',
          },
        },
        {
          $unwind: {
            path: '$author',
            preserveNullAndEmptyArrays: true,
          },
        },
        {
          $project: {
            _id: 1,
            courseId: 1,
            title: 1,
            content: 1,
            authorId: 1,
            author: {
              _id: '$author._id',
              username: '$author.username',
              fullName: '$author.fullName',
            },
            replyCount: { $size: '$replies' },
            lastReplyAt: {
              $let: {
                vars: {
                  lastReply: { $arrayElemAt: ['$replies', -1] },
                },
                in: '$$lastReply.updatedAt',
              },
            },
            createdAt: 1,
            updatedAt: 1,
          },
        },
      ]),
      this.courseDiscussionModel.countDocuments(filter),
    ]);

    return {
      items: items.map((item) => this.toDiscussionListItemDto(item)),
      total,
    };
  }

  async createDiscussion(
    courseId: string,
    payload: CreateCourseDiscussionDto,
    userId: string,
    role: UserRole,
  ): Promise<CourseDiscussionDetailDto> {
    await this.assertCanAccessCourse(courseId, userId, role);

    const created = await this.courseDiscussionModel.create({
      courseId: toObjectId(courseId),
      title: payload.title.trim(),
      content: payload.content.trim(),
      authorId: toObjectId(userId),
      replies: [],
    });

    const discussion = await this.courseDiscussionModel
      .findById(created._id)
      .populate('authorId', 'username fullName')
      .populate('replies.authorId', 'username fullName');

    if (!discussion) {
      throw new AppException(
        '讨论创建失败',
        ERROR_CODES.INTERNAL_SERVER_ERROR,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }

    return this.toDiscussionDetailDto(discussion);
  }

  async getDiscussionById(
    courseId: string,
    discussionId: string,
    userId: string,
    role: UserRole,
  ): Promise<CourseDiscussionDetailDto> {
    await this.assertCanAccessCourse(courseId, userId, role);

    const discussion = await this.findDiscussionForCourse(
      discussionId,
      courseId,
    );
    await discussion.populate('authorId', 'username fullName');

    return this.toDiscussionDetailDto(discussion);
  }

  async getDiscussionReplies(
    courseId: string,
    discussionId: string,
    userId: string,
    role: UserRole,
    query: QueryCourseDiscussionRepliesDto,
  ): Promise<CourseDiscussionRepliesPageDto> {
    await this.assertCanAccessCourse(courseId, userId, role);
    await this.findDiscussionForCourse(discussionId, courseId);

    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 20;
    const skip = (page - 1) * pageSize;

    const [result] =
      await this.courseDiscussionModel.aggregate<DiscussionRepliesAggregation>([
        {
          $match: {
            _id: toObjectId(discussionId),
            courseId: toObjectId(courseId),
          },
        },
        {
          $facet: {
            items: [
              { $unwind: '$replies' },
              { $replaceRoot: { newRoot: '$replies' } },
              { $sort: { createdAt: 1, _id: 1 } },
              { $skip: skip },
              { $limit: pageSize },
              {
                $lookup: {
                  from: 'users',
                  localField: 'authorId',
                  foreignField: '_id',
                  as: 'author',
                },
              },
              {
                $unwind: {
                  path: '$author',
                  preserveNullAndEmptyArrays: true,
                },
              },
              {
                $project: {
                  _id: 1,
                  content: 1,
                  authorId: 1,
                  author: {
                    _id: '$author._id',
                    username: '$author.username',
                    fullName: '$author.fullName',
                  },
                  createdAt: 1,
                  updatedAt: 1,
                },
              },
            ],
            total: [
              {
                $project: {
                  count: { $size: '$replies' },
                },
              },
            ],
          },
        },
      ]);

    return {
      items: (result?.items ?? []).map((item) => this.toReplyDto(item)),
      total: result?.total?.[0]?.count ?? 0,
    };
  }

  async createReply(
    courseId: string,
    discussionId: string,
    payload: CreateCourseDiscussionReplyDto,
    userId: string,
    role: UserRole,
  ): Promise<CourseDiscussionReplyDto> {
    await this.assertCanAccessCourse(courseId, userId, role);

    const discussion = await this.findDiscussionForCourse(
      discussionId,
      courseId,
    );
    discussion.replies.push({
      content: payload.content.trim(),
      authorId: toObjectId(userId),
    } as never);
    await discussion.save();
    const reply = discussion.replies[discussion.replies.length - 1];
    await discussion.populate({
      path: `replies.${discussion.replies.length - 1}.authorId`,
      select: 'username fullName',
    });

    return this.toReplyDto(reply);
  }

  async deleteDiscussion(
    courseId: string,
    discussionId: string,
    userId: string,
    role: UserRole,
  ): Promise<void> {
    const discussion = await this.findDiscussionForCourse(
      discussionId,
      courseId,
    );
    await this.assertCanDeleteDiscussion(discussion, userId, role);
    await this.courseDiscussionModel.deleteOne({ _id: discussion._id });
  }

  async deleteReply(
    courseId: string,
    discussionId: string,
    replyId: string,
    userId: string,
    role: UserRole,
  ): Promise<void> {
    const discussion = await this.findDiscussionForCourse(
      discussionId,
      courseId,
    );
    const reply = discussion.replies.id(replyId);

    if (!reply) {
      throw new AppException(
        '回复不存在',
        ERROR_CODES.NOT_FOUND,
        HttpStatus.NOT_FOUND,
      );
    }

    await this.assertCanDeleteReply(
      discussion,
      reply.authorId.toString(),
      userId,
      role,
    );
    reply.deleteOne();
    await discussion.save();
  }

  async removeDiscussionsByCourseId(courseId: string): Promise<void> {
    await this.courseDiscussionModel.deleteMany({
      courseId: toObjectId(courseId),
    });
  }

  private buildDiscussionFilter(
    courseId: string,
    query: QueryCourseDiscussionsDto,
  ): Record<string, unknown> {
    const filter: Record<string, unknown> = {
      courseId: toObjectId(courseId),
    };

    if (query.search?.trim()) {
      const search = query.search.trim();
      filter.$or = [
        { title: { $regex: search, $options: 'i' } },
        { content: { $regex: search, $options: 'i' } },
      ];
    }

    return filter;
  }

  private async assertCanAccessCourse(
    courseId: string,
    userId: string,
    role: UserRole,
  ): Promise<void> {
    await this.coursePermissionService.getAccessibleCourse(
      courseId,
      userId,
      role,
      {
        notFoundMessage: '课程不存在',
        forbiddenMessage: '无权访问当前课程讨论',
        notMemberMessage: '未加入当前课程',
      },
    );
  }

  private async assertCanDeleteDiscussion(
    discussion: CourseDiscussionDocument,
    userId: string,
    role: UserRole,
  ) {
    if (role === 'admin') {
      return;
    }

    if (discussion.authorId.toString() === userId) {
      return;
    }

    if (role === 'teacher') {
      const course = await this.courseModel.findById(discussion.courseId);
      if (course?.teacherId.toString() === userId) {
        return;
      }
    }

    throw new AppException(
      '无权删除当前讨论',
      ERROR_CODES.FORBIDDEN,
      HttpStatus.FORBIDDEN,
    );
  }

  private async assertCanDeleteReply(
    discussion: CourseDiscussionDocument,
    replyAuthorId: string,
    userId: string,
    role: UserRole,
  ) {
    if (role === 'admin' || replyAuthorId === userId) {
      return;
    }

    if (role === 'teacher') {
      const course = await this.courseModel.findById(discussion.courseId);
      if (course?.teacherId.toString() === userId) {
        return;
      }
    }

    throw new AppException(
      '无权删除当前回复',
      ERROR_CODES.FORBIDDEN,
      HttpStatus.FORBIDDEN,
    );
  }

  private async findDiscussionForCourse(
    discussionId: string,
    courseId: string,
  ): Promise<CourseDiscussionDocument> {
    const discussion = await this.courseDiscussionModel.findOne({
      _id: toObjectId(discussionId),
      courseId: toObjectId(courseId),
    });

    if (!discussion) {
      throw new AppException(
        '讨论不存在',
        ERROR_CODES.NOT_FOUND,
        HttpStatus.NOT_FOUND,
      );
    }

    return discussion;
  }

  private toDiscussionListItemDto(
    discussion: CourseDiscussionDocument | DiscussionListAggregation,
  ): CourseDiscussionListItemDto {
    const discussionId = readObjectId(discussion._id);
    const courseObjectId = readObjectId(discussion.courseId);
    const authorId = this.readUserReferenceId(
      discussion.authorId as UserReference,
    );
    const replyCount =
      'replyCount' in discussion && typeof discussion.replyCount === 'number'
        ? discussion.replyCount
        : 'replies' in discussion && Array.isArray(discussion.replies)
          ? discussion.replies.length
          : 0;
    const lastReplyAt =
      'lastReplyAt' in discussion && discussion.lastReplyAt
        ? discussion.lastReplyAt.toISOString()
        : undefined;
    const createdAt =
      discussion.createdAt instanceof Date
        ? discussion.createdAt.toISOString()
        : new Date(discussion.createdAt).toISOString();
    const updatedAt =
      discussion.updatedAt instanceof Date
        ? discussion.updatedAt.toISOString()
        : new Date(discussion.updatedAt).toISOString();

    return {
      id: discussionId,
      courseId: courseObjectId,
      title: discussion.title,
      content: discussion.content,
      authorId,
      author:
        'author' in discussion && discussion.author
          ? this.toAuthorDto(discussion.author)
          : this.toAuthorDto(discussion.authorId),
      replyCount,
      lastReplyAt,
      createdAt,
      updatedAt,
    };
  }

  private toDiscussionDetailDto(
    discussion: CourseDiscussionDocument,
  ): CourseDiscussionDetailDto {
    return {
      ...this.toDiscussionListItemDto(discussion),
    };
  }

  private toReplyDto(reply: {
    _id?: Types.ObjectId;
    id?: string;
    content: string;
    authorId: UserReference;
    author?: UserReference;
    createdAt: Date;
    updatedAt: Date;
  }): CourseDiscussionReplyDto {
    return {
      id: reply._id?.toString() ?? reply.id ?? '',
      content: reply.content,
      authorId: this.readUserReferenceId(reply.authorId),
      author: reply.author
        ? this.toAuthorDto(reply.author)
        : this.toAuthorDto(reply.authorId),
      createdAt: reply.createdAt.toISOString(),
      updatedAt: reply.updatedAt.toISOString(),
    };
  }

  private toAuthorDto(
    author: UserReference,
  ): CourseDiscussionAuthorDto | undefined {
    if (author instanceof Types.ObjectId) {
      return undefined;
    }

    return {
      id: this.readUserReferenceId(author),
      username: typeof author.username === 'string' ? author.username : '',
      fullName:
        typeof author.fullName === 'string' ? author.fullName : undefined,
    };
  }

  private readUserReferenceId(author: UserReference): string {
    if (author instanceof Types.ObjectId) {
      return author.toString();
    }

    const rawId = author._id;
    if (rawId instanceof Types.ObjectId) {
      return rawId.toString();
    }

    if (typeof rawId === 'string') {
      return rawId;
    }

    if (typeof author.id === 'string') {
      return author.id;
    }

    return '';
  }
}
