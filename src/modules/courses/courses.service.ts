import { HttpStatus, Injectable } from '@nestjs/common';
import { InjectConnection, InjectModel } from '@nestjs/mongoose';
import fs from 'fs';
import path from 'path';
import { Connection, Model, PipelineStage, Types } from 'mongoose';
import { ERROR_CODES } from '../../common/constants/error-codes';
import { AppException } from '../../common/exceptions/app.exception';
import type { UserRole } from '../../common/interfaces/auth-user.interface';
import { CreateCourseDto } from './dto/create-course.dto';
import { QueryCourseMembersDto } from './dto/query-course-members.dto';
import { QueryCoursesDto } from './dto/query-courses.dto';
import { UpdateCourseDto } from './dto/update-course.dto';
import {
  CoursesPageDto,
  CourseDetailDto,
  CourseMembersPageDto,
  CourseSummaryDto,
} from './interfaces/course-response.interface';
import { Course, CourseDocument } from './schemas/course.schema';
import {
  CourseMember,
  CourseMemberDocument,
} from './schemas/course-member.schema';
import {
  CourseResource,
  CourseResourceDocument,
} from '../course-resources/schemas/course-resource.schema';

interface CountAggregation {
  _id: Types.ObjectId;
  count: number;
}

interface MembersFacetAggregation {
  items: Record<string, unknown>[];
  total: Array<{ count: number }>;
}

interface CourseIdsFacetAggregation {
  items: Array<{ courseId: Types.ObjectId }>;
  total: Array<{ count: number }>;
}

@Injectable()
export class CoursesService {
  constructor(
    @InjectModel(Course.name)
    private readonly courseModel: Model<CourseDocument>,
    @InjectModel(CourseMember.name)
    private readonly courseMemberModel: Model<CourseMemberDocument>,
    @InjectModel(CourseResource.name)
    private readonly courseResourceModel: Model<CourseResourceDocument>,
    @InjectConnection()
    private readonly connection: Connection,
  ) {}

  async createCourse(
    payload: CreateCourseDto,
    teacherId: string,
  ): Promise<CourseDetailDto> {
    const sanitized = this.sanitizeCoursePayload(payload);
    await this.ensureCourseCodeUnique(sanitized.courseCode);

    const created = await this.courseModel.create({
      ...sanitized,
      teacherId: this.toObjectId(teacherId),
      isArchived: false,
      archivedAt: null,
    });

    return this.getCourseById(created._id.toString(), teacherId, 'admin');
  }

  async getCourses(
    userId: string,
    role: UserRole,
    query: QueryCoursesDto,
  ): Promise<CoursesPageDto> {
    const includeArchived = query.includeArchived ?? false;
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 10;
    const skip = (page - 1) * pageSize;

    const courseQuery: Record<string, unknown> = {};
    if (!includeArchived || role === 'student') {
      courseQuery.isArchived = { $ne: true };
    }

    let rawCourses: Array<CourseDocument | Record<string, unknown>> = [];
    let total = 0;

    if (role === 'admin' || role === 'teacher') {
      const scopedQuery: Record<string, unknown> =
        role === 'teacher'
          ? {
              ...courseQuery,
              teacherId: this.toObjectId(userId),
            }
          : courseQuery;

      const [courses, totalCount] = await Promise.all([
        this.courseModel
          .find(scopedQuery)
          .populate('teacherId', 'fullName username')
          .sort({ createdAt: -1 })
          .skip(skip)
          .limit(pageSize),
        this.courseModel.countDocuments(scopedQuery),
      ]);

      rawCourses = courses;
      total = totalCount;
    } else {
      const pipeline: PipelineStage[] = [
        {
          $match: {
            userId: this.toObjectId(userId),
          },
        },
        { $sort: { createdAt: -1 } },
        {
          $lookup: {
            from: 'courses',
            localField: 'courseId',
            foreignField: '_id',
            as: 'course',
          },
        },
        { $unwind: '$course' },
      ];

      if (courseQuery.isArchived) {
        pipeline.push({
          $match: { 'course.isArchived': courseQuery.isArchived },
        });
      }

      pipeline.push({
        $facet: {
          items: [
            { $project: { courseId: '$course._id' } },
            { $skip: skip },
            { $limit: pageSize },
          ],
          total: [{ $count: 'count' }],
        },
      });

      const [result] =
        await this.courseMemberModel.aggregate<CourseIdsFacetAggregation>(
          pipeline,
        );
      total =
        result && Array.isArray(result.total) && result.total[0]
          ? result.total[0].count
          : 0;

      const pagedCourseIds = Array.isArray(result?.items)
        ? result.items
            .map((item) => this.readString(item.courseId))
            .filter((id): id is string => Boolean(id))
        : [];

      if (!pagedCourseIds.length) {
        return {
          items: [],
          total,
        };
      }

      const pagedCourses = await this.courseModel
        .find({ _id: { $in: pagedCourseIds.map((id) => this.toObjectId(id)) } })
        .populate('teacherId', 'fullName username');

      const pagedCourseMap = new Map<
        string,
        CourseDocument | Record<string, unknown>
      >(pagedCourses.map((course) => [this.extractCourseId(course), course]));

      rawCourses = pagedCourseIds
        .map((id) => pagedCourseMap.get(id))
        .filter((course): course is CourseDocument | Record<string, unknown> =>
          Boolean(course),
        );
    }

    const courseIds = rawCourses
      .map((course) => this.extractCourseId(course))
      .filter((id): id is string => Boolean(id));
    const statsMap = await this.buildCourseStats(courseIds);

    return {
      items: rawCourses.map((course) => this.toCourseSummary(course, statsMap)),
      total,
    };
  }

  async getAvailableCourses(
    userId: string,
    keyword?: string,
  ): Promise<CourseSummaryDto[]> {
    const joined = await this.courseMemberModel.find(
      { userId: this.toObjectId(userId) },
      { courseId: 1 },
    );
    const joinedCourseIds = joined.map((item) => item.courseId);

    const query: Record<string, unknown> = {
      _id: { $nin: joinedCourseIds },
      isArchived: { $ne: true },
    };

    if (keyword?.trim()) {
      const escapedKeyword = this.escapeRegex(keyword.trim());
      query.$or = [
        { title: { $regex: escapedKeyword, $options: 'i' } },
        { courseCode: { $regex: escapedKeyword, $options: 'i' } },
      ];
    }

    const courses = await this.courseModel
      .find(query)
      .populate('teacherId', 'fullName username')
      .sort({ createdAt: -1 });

    const statsMap = await this.buildCourseStats(
      courses.map((course) => course._id.toString()),
    );

    return courses.map((course) => this.toCourseSummary(course, statsMap));
  }

  async getCourseById(
    courseId: string,
    userId: string,
    role: UserRole,
  ): Promise<CourseDetailDto> {
    const targetId = this.toObjectId(courseId);
    const baseQuery: Record<string, unknown> = { _id: targetId };

    if (role === 'teacher') {
      baseQuery.teacherId = this.toObjectId(userId);
    }

    if (role === 'student') {
      await this.assertStudentMember(targetId, userId);
    }

    const course = await this.courseModel
      .findOne(baseQuery)
      .populate('teacherId', 'fullName username');

    if (!course) {
      throw new AppException(
        '课程不存在或无访问权限',
        ERROR_CODES.NOT_FOUND,
        HttpStatus.NOT_FOUND,
      );
    }

    const statsMap = await this.buildCourseStats([course._id.toString()]);
    return this.toCourseSummary(course, statsMap);
  }

  async updateCourse(
    courseId: string,
    payload: UpdateCourseDto,
    userId: string,
    role: UserRole,
  ): Promise<CourseDetailDto> {
    const target = await this.findEditableCourse(courseId, userId, role);
    const sanitized = this.sanitizeCoursePayload(payload);

    if (sanitized.courseCode) {
      await this.ensureCourseCodeUnique(sanitized.courseCode, target._id);
    }

    Object.assign(target, sanitized);
    await target.save();

    return this.getCourseById(target._id.toString(), userId, 'admin');
  }

  async deleteCourse(
    courseId: string,
    userId: string,
    role: UserRole,
  ): Promise<void> {
    const target = await this.findEditableCourse(courseId, userId, role);
    const resources = await this.courseResourceModel.find(
      { courseId: target._id },
      { fileKey: 1 },
    );

    await Promise.all([
      this.courseMemberModel.deleteMany({ courseId: target._id }),
      this.courseResourceModel.deleteMany({ courseId: target._id }),
      this.courseModel.deleteOne({ _id: target._id }),
    ]);

    await Promise.all(
      resources.map(async (resource) => {
        try {
          const targetPath = this.getStoredFilePath(resource.fileKey);
          await fs.promises.unlink(targetPath);
        } catch {
          return;
        }
      }),
    );
  }

  async joinCourse(courseId: string, userId: string): Promise<void> {
    const targetId = this.toObjectId(courseId);
    const course = await this.courseModel.findById(targetId);

    if (!course) {
      throw new AppException(
        '课程不存在',
        ERROR_CODES.NOT_FOUND,
        HttpStatus.NOT_FOUND,
      );
    }

    if (course.isArchived) {
      throw new AppException(
        '归档课程不可加入',
        ERROR_CODES.BAD_REQUEST,
        HttpStatus.BAD_REQUEST,
      );
    }

    if (course.maxStudents) {
      const current = await this.countStudentMembers(targetId);
      if (current >= course.maxStudents) {
        throw new AppException(
          '课程人数已满',
          ERROR_CODES.BAD_REQUEST,
          HttpStatus.BAD_REQUEST,
        );
      }
    }

    const existing = await this.courseMemberModel.findOne({
      courseId: targetId,
      userId: this.toObjectId(userId),
    });
    if (existing) {
      throw new AppException(
        '你已加入该课程',
        ERROR_CODES.BAD_REQUEST,
        HttpStatus.BAD_REQUEST,
      );
    }

    await this.courseMemberModel.create({
      courseId: targetId,
      userId: this.toObjectId(userId),
    });
  }

  async leaveCourse(courseId: string, userId: string): Promise<void> {
    const targetId = this.toObjectId(courseId);
    const removed = await this.courseMemberModel.findOneAndDelete({
      courseId: targetId,
      userId: this.toObjectId(userId),
    });
    if (!removed) {
      throw new AppException(
        '你未加入该课程',
        ERROR_CODES.NOT_FOUND,
        HttpStatus.NOT_FOUND,
      );
    }
  }

  async getCourseMembers(
    courseId: string,
    userId: string,
    role: UserRole,
    query: QueryCourseMembersDto,
  ): Promise<CourseMembersPageDto> {
    const targetId = this.toObjectId(courseId);
    await this.assertCanViewMembers(targetId, userId, role);

    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 10;
    const onlyStudents = query.onlyStudents ?? true;
    const skip = (page - 1) * pageSize;

    const pipeline: PipelineStage[] = [
      { $match: { courseId: targetId } },
      {
        $lookup: {
          from: 'users',
          localField: 'userId',
          foreignField: '_id',
          as: 'user',
        },
      },
      { $unwind: '$user' },
    ];

    if (onlyStudents) {
      pipeline.push({ $match: { 'user.role': 'student' } });
    }

    pipeline.push({
      $facet: {
        items: [
          { $sort: { createdAt: -1 } },
          { $skip: skip },
          { $limit: pageSize },
          {
            $project: {
              _id: 1,
              courseId: 1,
              userId: 1,
              joinDate: 1,
              createdAt: 1,
              updatedAt: 1,
              user: {
                _id: '$user._id',
                username: '$user.username',
                email: '$user.email',
                role: '$user.role',
                fullName: '$user.fullName',
                avatar: '$user.avatar',
              },
            },
          },
        ],
        total: [{ $count: 'count' }],
      },
    });

    const [result] =
      await this.courseMemberModel.aggregate<MembersFacetAggregation>(pipeline);
    const total =
      result && Array.isArray(result.total) && result.total[0]
        ? result.total[0].count
        : 0;
    const sourceItems =
      result && Array.isArray(result.items) ? result.items : [];
    const items = sourceItems.map((item) => this.toCourseMember(item));

    return {
      items,
      total,
    };
  }

  async removeMember(
    courseId: string,
    targetUserId: string,
    operatorUserId: string,
    role: UserRole,
  ): Promise<void> {
    const targetCourseId = this.toObjectId(courseId);
    const targetMemberUserId = this.toObjectId(targetUserId);

    if (operatorUserId === targetUserId) {
      throw new AppException(
        '不能移除自己',
        ERROR_CODES.BAD_REQUEST,
        HttpStatus.BAD_REQUEST,
      );
    }

    if (role === 'teacher') {
      const owned = await this.courseModel.exists({
        _id: targetCourseId,
        teacherId: this.toObjectId(operatorUserId),
      });
      if (!owned) {
        throw new AppException(
          '课程不存在或无管理权限',
          ERROR_CODES.NOT_FOUND,
          HttpStatus.NOT_FOUND,
        );
      }
    } else {
      const course = await this.courseModel.exists({ _id: targetCourseId });
      if (!course) {
        throw new AppException(
          '课程不存在',
          ERROR_CODES.NOT_FOUND,
          HttpStatus.NOT_FOUND,
        );
      }
    }

    const member = await this.courseMemberModel.findOne({
      courseId: targetCourseId,
      userId: targetMemberUserId,
    });

    if (!member) {
      throw new AppException(
        '该成员不在课程中',
        ERROR_CODES.NOT_FOUND,
        HttpStatus.NOT_FOUND,
      );
    }

    const targetUser = await this.connection.collection('users').findOne<{
      role?: string;
    }>({ _id: targetMemberUserId }, { projection: { role: 1 } });

    if (!targetUser || targetUser.role !== 'student') {
      throw new AppException(
        '当前仅支持移除学生成员',
        ERROR_CODES.BAD_REQUEST,
        HttpStatus.BAD_REQUEST,
      );
    }

    await this.courseMemberModel.deleteOne({ _id: member._id });
  }

  async setCourseArchiveStatus(
    courseId: string,
    operatorUserId: string,
    role: UserRole,
    isArchived: boolean,
  ): Promise<void> {
    const course = await this.findEditableCourse(
      courseId,
      operatorUserId,
      role,
    );

    course.isArchived = isArchived;
    course.archivedAt = isArchived ? new Date() : null;

    await course.save();
  }

  private async findEditableCourse(
    courseId: string,
    userId: string,
    role: UserRole,
  ): Promise<CourseDocument> {
    const targetId = this.toObjectId(courseId);
    const query: Record<string, unknown> = { _id: targetId };
    if (role === 'teacher') {
      query.teacherId = this.toObjectId(userId);
    }

    const course = await this.courseModel.findOne(query);
    if (!course) {
      throw new AppException(
        '课程不存在或无编辑权限',
        ERROR_CODES.NOT_FOUND,
        HttpStatus.NOT_FOUND,
      );
    }

    return course;
  }

  private async assertCanViewMembers(
    courseId: Types.ObjectId,
    userId: string,
    role: UserRole,
  ): Promise<void> {
    if (role === 'admin') {
      return;
    }

    if (role === 'teacher') {
      const owned = await this.courseModel.exists({
        _id: courseId,
        teacherId: this.toObjectId(userId),
      });
      if (owned) {
        return;
      }
    }

    if (role === 'student') {
      const joined = await this.courseMemberModel.exists({
        courseId,
        userId: this.toObjectId(userId),
      });
      if (joined) {
        return;
      }
    }

    throw new AppException(
      '无权限查看课程成员',
      ERROR_CODES.FORBIDDEN,
      HttpStatus.FORBIDDEN,
    );
  }

  private async assertStudentMember(
    courseId: Types.ObjectId,
    userId: string,
  ): Promise<void> {
    const membership = await this.courseMemberModel.exists({
      courseId,
      userId: this.toObjectId(userId),
    });
    if (!membership) {
      throw new AppException(
        '你未加入该课程',
        ERROR_CODES.FORBIDDEN,
        HttpStatus.FORBIDDEN,
      );
    }
  }

  private sanitizeCoursePayload(payload: CreateCourseDto | UpdateCourseDto) {
    const next = { ...payload };

    if (typeof next.title === 'string') {
      next.title = next.title.trim();
      if (!next.title) {
        throw new AppException(
          '课程标题不能为空',
          ERROR_CODES.BAD_REQUEST,
          HttpStatus.BAD_REQUEST,
        );
      }
    }

    if (typeof next.description === 'string') {
      next.description = next.description.trim();
    }

    if (typeof next.courseCode === 'string') {
      const normalized = next.courseCode.trim().toUpperCase();
      next.courseCode = normalized || undefined;
    }

    if (typeof next.coverImage === 'string') {
      next.coverImage = next.coverImage.trim();
    }

    if (typeof next.semester === 'string') {
      next.semester = next.semester.trim();
    }

    return next;
  }

  private async ensureCourseCodeUnique(
    courseCode?: string,
    excludeId?: Types.ObjectId,
  ): Promise<void> {
    if (!courseCode) {
      return;
    }

    const query: Record<string, unknown> = { courseCode };
    if (excludeId) {
      query._id = { $ne: excludeId };
    }

    const exists = await this.courseModel.exists(query);
    if (exists) {
      throw new AppException(
        '课程代码已存在',
        ERROR_CODES.BAD_REQUEST,
        HttpStatus.BAD_REQUEST,
      );
    }
  }

  private async buildCourseStats(courseIds: string[]) {
    if (!courseIds.length) {
      return new Map<
        string,
        {
          studentCount: number;
          taskCount: number;
        }
      >();
    }

    const objectIds = courseIds.map((id) => this.toObjectId(id));
    const [studentStats, taskStats] = await Promise.all([
      this.courseMemberModel.aggregate<CountAggregation>([
        { $match: { courseId: { $in: objectIds } } },
        {
          $lookup: {
            from: 'users',
            localField: 'userId',
            foreignField: '_id',
            as: 'user',
          },
        },
        { $unwind: '$user' },
        { $match: { 'user.role': 'student' } },
        { $group: { _id: '$courseId', count: { $sum: 1 } } },
      ]),
      this.connection
        .collection('tasks')
        .aggregate<CountAggregation>([
          { $match: { courseId: { $in: objectIds } } },
          { $group: { _id: '$courseId', count: { $sum: 1 } } },
        ])
        .toArray(),
    ]);

    const map = new Map<
      string,
      {
        studentCount: number;
        taskCount: number;
      }
    >();

    for (const id of courseIds) {
      map.set(id, { studentCount: 0, taskCount: 0 });
    }

    for (const stat of studentStats) {
      map.set(String(stat._id), {
        ...(map.get(String(stat._id)) ?? { studentCount: 0, taskCount: 0 }),
        studentCount: stat.count,
      });
    }

    for (const stat of taskStats) {
      map.set(String(stat._id), {
        ...(map.get(String(stat._id)) ?? { studentCount: 0, taskCount: 0 }),
        taskCount: stat.count,
      });
    }

    return map;
  }

  private toCourseSummary(
    course: CourseDocument | Record<string, unknown>,
    statsMap: Map<string, { studentCount: number; taskCount: number }>,
  ): CourseSummaryDto {
    const doc = course as Record<string, unknown>;
    const id = this.extractCourseId(course);
    const stats = statsMap.get(id) ?? { studentCount: 0, taskCount: 0 };
    const teacher = (doc.teacherId ?? {}) as Record<string, unknown>;
    const teacherName =
      (typeof teacher.fullName === 'string' && teacher.fullName) ||
      (typeof teacher.username === 'string' && teacher.username) ||
      '未知';

    return {
      id,
      title: this.readString(doc.title) ?? '',
      description: this.readString(doc.description) ?? '',
      courseCode:
        typeof doc.courseCode === 'string' ? doc.courseCode : undefined,
      coverImage: this.normalizeAssetUrl(doc.coverImage),
      semester: typeof doc.semester === 'string' ? doc.semester : undefined,
      credits: typeof doc.credits === 'number' ? doc.credits : undefined,
      maxStudents:
        typeof doc.maxStudents === 'number' || doc.maxStudents === null
          ? doc.maxStudents
          : undefined,
      teacherId: this.extractTeacherId(doc.teacherId),
      teacherName,
      studentCount: stats.studentCount,
      taskCount: stats.taskCount,
      isArchived: Boolean(doc.isArchived),
      archivedAt: this.toISOStringOrNull(doc.archivedAt),
      createdAt: this.toISOString(doc.createdAt),
      updatedAt: this.toISOString(doc.updatedAt),
    };
  }

  private toCourseMember(item: Record<string, unknown>) {
    const user = (item.user ?? {}) as Record<string, unknown>;
    return {
      id: String(item._id),
      courseId: String(item.courseId),
      userId: String(item.userId),
      joinDate: this.toISOString(item.joinDate),
      createdAt: this.toISOString(item.createdAt),
      updatedAt: this.toISOString(item.updatedAt),
      user: {
        id: this.readString(user._id) ?? '',
        username: this.readString(user.username) ?? '',
        email: this.readString(user.email) ?? '',
        role: this.readString(user.role) ?? '',
        fullName: typeof user.fullName === 'string' ? user.fullName : undefined,
        avatar: this.normalizeAssetUrl(user.avatar),
      },
    };
  }

  private normalizeAssetUrl(value: unknown): string | undefined {
    const raw = this.readString(value)?.trim();
    if (!raw) {
      return undefined;
    }

    if (raw.startsWith('/uploads/')) {
      return raw;
    }

    if (raw.startsWith('uploads/')) {
      return `/${raw}`;
    }

    const uploadsIndex = raw.lastIndexOf('/uploads/');
    if (uploadsIndex >= 0) {
      return raw.slice(uploadsIndex);
    }

    return raw;
  }

  private extractCourseId(course: CourseDocument | Record<string, unknown>) {
    const raw = (course as Record<string, unknown>)._id;
    if (raw instanceof Types.ObjectId) {
      return raw.toString();
    }
    return this.readString(raw) ?? '';
  }

  private extractTeacherId(rawTeacherId: unknown): string {
    if (rawTeacherId instanceof Types.ObjectId) {
      return rawTeacherId.toString();
    }
    if (rawTeacherId && typeof rawTeacherId === 'object') {
      const teacherDoc = rawTeacherId as Record<string, unknown>;
      if (teacherDoc._id instanceof Types.ObjectId) {
        return teacherDoc._id.toString();
      }
      if (teacherDoc._id) {
        return this.readString(teacherDoc._id) ?? '';
      }
    }
    return this.readString(rawTeacherId) ?? '';
  }

  private toObjectId(value: string): Types.ObjectId {
    if (!Types.ObjectId.isValid(value)) {
      throw new AppException(
        '参数 ID 不合法',
        ERROR_CODES.BAD_REQUEST,
        HttpStatus.BAD_REQUEST,
      );
    }
    return new Types.ObjectId(value);
  }

  private toISOString(value: unknown): string {
    if (value instanceof Date) {
      return value.toISOString();
    }
    if (typeof value !== 'string' && typeof value !== 'number') {
      return new Date(0).toISOString();
    }
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
      return new Date(0).toISOString();
    }
    return date.toISOString();
  }

  private toISOStringOrNull(value: unknown): string | null {
    if (!value) {
      return null;
    }
    return this.toISOString(value);
  }

  private countStudentMembers(courseId: Types.ObjectId) {
    return this.courseMemberModel
      .aggregate<CountAggregation>([
        { $match: { courseId } },
        {
          $lookup: {
            from: 'users',
            localField: 'userId',
            foreignField: '_id',
            as: 'user',
          },
        },
        { $unwind: '$user' },
        { $match: { 'user.role': 'student' } },
        { $count: 'count' },
      ])
      .then((rows) => rows[0]?.count ?? 0);
  }

  private escapeRegex(input: string): string {
    return input.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  private getStoredFilePath(fileKey: string): string {
    const uploadsDir =
      process.env.UPLOADS_DIR?.trim() || path.join(process.cwd(), 'uploads');
    const normalizedKey = fileKey.trim();
    const relativePath = normalizedKey.startsWith('uploads/')
      ? normalizedKey.slice('uploads/'.length)
      : normalizedKey;
    const targetPath = path.resolve(uploadsDir, relativePath);
    const normalizedUploadsDir = path.resolve(uploadsDir);

    if (!targetPath.startsWith(normalizedUploadsDir)) {
      throw new AppException(
        '资源文件路径异常',
        ERROR_CODES.BAD_REQUEST,
        HttpStatus.BAD_REQUEST,
      );
    }

    return targetPath;
  }

  private readString(value: unknown): string | undefined {
    if (value instanceof Types.ObjectId) {
      return value.toString();
    }
    if (typeof value === 'string') {
      return value;
    }
    if (typeof value === 'number' || typeof value === 'boolean') {
      return String(value);
    }
    return undefined;
  }
}
