import { HttpStatus, Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { ERROR_CODES } from '../../common/constants/error-codes';
import { AppException } from '../../common/exceptions/app.exception';
import { toObjectId } from '../../common/utils/model-value.util';
import type { UserRole } from '../../common/interfaces/auth-user.interface';
import { CoursePermissionService } from '../courses/course-permission.service';
import { UploadStorageService } from '../uploads/upload-storage.service';
import { CreateCourseResourceDto } from './dto/create-course-resource.dto';
import { QueryCourseResourcesDto } from './dto/query-course-resources.dto';
import { UpdateCourseResourceDto } from './dto/update-course-resource.dto';
import {
  CourseResourceDto,
  CourseResourcesPageDto,
} from './interfaces/course-resource-response.interface';
import {
  CourseResource,
  CourseResourceDocument,
} from './schemas/course-resource.schema';

@Injectable()
export class CourseResourcesService {
  constructor(
    @InjectModel(CourseResource.name)
    private readonly courseResourceModel: Model<CourseResourceDocument>,
    private readonly coursePermissionService: CoursePermissionService,
    private readonly uploadStorageService: UploadStorageService,
  ) {}

  async getResources(
    courseId: string,
    userId: string,
    role: UserRole,
    query: QueryCourseResourcesDto,
  ): Promise<CourseResourcesPageDto> {
    await this.assertCanAccessCourse(courseId, userId, role);

    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 10;
    const skip = (page - 1) * pageSize;
    const filter = this.buildResourceFilter(courseId, query);

    const [items, total] = await Promise.all([
      this.courseResourceModel
        .find(filter)
        .populate('uploaderId', 'username fullName')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(pageSize),
      this.courseResourceModel.countDocuments(filter),
    ]);

    return {
      items: items.map((item) => this.toResourceDto(item)),
      total,
    };
  }

  async createResource(
    courseId: string,
    payload: CreateCourseResourceDto,
    userId: string,
    role: UserRole,
  ): Promise<CourseResourceDto> {
    await this.assertCanManageCourseResources(courseId, userId, role);

    const sanitized = this.sanitizeCreatePayload(payload);
    const created = await this.courseResourceModel.create({
      courseId: toObjectId(courseId),
      ...sanitized,
      uploaderId: toObjectId(userId),
    });

    const resource = await this.courseResourceModel
      .findById(created._id)
      .populate('uploaderId', 'username fullName');

    if (!resource) {
      throw new AppException(
        '资源创建失败',
        ERROR_CODES.INTERNAL_SERVER_ERROR,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }

    return this.toResourceDto(resource);
  }

  async updateResource(
    courseId: string,
    resourceId: string,
    payload: UpdateCourseResourceDto,
    userId: string,
    role: UserRole,
  ): Promise<CourseResourceDto> {
    const resource = await this.findResourceForCourse(resourceId, courseId);
    await this.assertCanManageExistingResource(resource, userId, role);

    const sanitized = this.sanitizeUpdatePayload(payload);
    Object.assign(resource, sanitized);
    await resource.save();
    await resource.populate('uploaderId', 'username fullName');

    return this.toResourceDto(resource);
  }

  async deleteResource(
    courseId: string,
    resourceId: string,
    userId: string,
    role: UserRole,
  ): Promise<void> {
    const resource = await this.findResourceForCourse(resourceId, courseId);
    await this.assertCanManageExistingResource(resource, userId, role);

    await this.courseResourceModel.deleteOne({ _id: resource._id });
    await this.removeStoredFile(resource.fileKey);
  }

  async getResourceById(
    courseId: string,
    resourceId: string,
    userId: string,
    role: UserRole,
  ): Promise<CourseResourceDto> {
    const resource = await this.findResourceForCourse(resourceId, courseId);
    await this.assertCanAccessCourse(courseId, userId, role);
    await resource.populate('uploaderId', 'username fullName');

    return this.toResourceDto(resource);
  }

  async removeResourcesByCourseId(courseId: string): Promise<void> {
    const resources = await this.courseResourceModel.find(
      { courseId: toObjectId(courseId) },
      { fileKey: 1 },
    );

    await this.courseResourceModel.deleteMany({
      courseId: toObjectId(courseId),
    });

    await Promise.all(
      resources.map((resource) => this.removeStoredFile(resource.fileKey)),
    );
  }

  private buildResourceFilter(
    courseId: string,
    query: QueryCourseResourcesDto,
  ): Record<string, unknown> {
    const filter: Record<string, unknown> = {
      courseId: toObjectId(courseId),
    };

    if (query.type) {
      filter.type = query.type;
    }

    if (query.search?.trim()) {
      const search = query.search.trim();
      filter.$or = [
        { title: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } },
        { originalFileName: { $regex: search, $options: 'i' } },
      ];
    }

    return filter;
  }

  private sanitizeCreatePayload(payload: CreateCourseResourceDto) {
    const title = payload.title.trim();
    if (!title) {
      throw new AppException(
        '资源标题不能为空',
        ERROR_CODES.BAD_REQUEST,
        HttpStatus.BAD_REQUEST,
      );
    }

    const fileKey = payload.fileKey.trim();
    const fileUrl = payload.fileUrl.trim();
    const originalFileName = payload.originalFileName.trim();
    const mimeType = payload.mimeType.trim();

    if (!fileKey || !fileUrl || !originalFileName || !mimeType) {
      throw new AppException(
        '资源文件信息不完整',
        ERROR_CODES.BAD_REQUEST,
        HttpStatus.BAD_REQUEST,
      );
    }

    return {
      title,
      description: payload.description?.trim() ?? '',
      type: payload.type,
      fileKey,
      fileUrl,
      originalFileName,
      mimeType,
      size: payload.size,
    };
  }

  private sanitizeUpdatePayload(payload: UpdateCourseResourceDto) {
    const next: Record<string, unknown> = {};

    if (typeof payload.title === 'string') {
      const title = payload.title.trim();
      if (!title) {
        throw new AppException(
          '资源标题不能为空',
          ERROR_CODES.BAD_REQUEST,
          HttpStatus.BAD_REQUEST,
        );
      }
      next.title = title;
    }

    if (typeof payload.description === 'string') {
      next.description = payload.description.trim();
    }

    if (payload.type) {
      next.type = payload.type;
    }

    return next;
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
        forbiddenMessage: '无权访问当前课程资源',
        notMemberMessage: '未加入当前课程',
      },
    );
  }

  private async assertCanManageCourseResources(
    courseId: string,
    userId: string,
    role: UserRole,
  ): Promise<void> {
    await this.coursePermissionService.getManageableCourse(
      courseId,
      userId,
      role,
      {
        notFoundMessage: '课程不存在',
        forbiddenMessage: '无权访问当前课程资源',
        studentForbiddenMessage: '学生不能管理课程资源',
      },
    );
  }

  private async assertCanManageExistingResource(
    resource: CourseResourceDocument,
    userId: string,
    role: UserRole,
  ): Promise<void> {
    await this.assertCanManageCourseResources(
      resource.courseId.toString(),
      userId,
      role,
    );

    if (role === 'admin') {
      return;
    }

    if (resource.uploaderId.toString() !== userId) {
      throw new AppException(
        '只能操作自己上传的资源',
        ERROR_CODES.FORBIDDEN,
        HttpStatus.FORBIDDEN,
      );
    }
  }

  private async findResourceForCourse(
    resourceId: string,
    courseId: string,
  ): Promise<CourseResourceDocument> {
    const resource = await this.courseResourceModel.findOne({
      _id: toObjectId(resourceId),
      courseId: toObjectId(courseId),
    });

    if (!resource) {
      throw new AppException(
        '资源不存在',
        ERROR_CODES.NOT_FOUND,
        HttpStatus.NOT_FOUND,
      );
    }

    return resource;
  }

  private toResourceDto(resource: CourseResourceDocument): CourseResourceDto {
    const uploader =
      resource.uploaderId && typeof resource.uploaderId === 'object'
        ? (resource.uploaderId as Types.ObjectId & {
            _id?: Types.ObjectId;
            username?: string;
            fullName?: string;
          })
        : null;

    return {
      id: resource._id.toString(),
      courseId: resource.courseId.toString(),
      title: resource.title,
      description: resource.description || undefined,
      type: resource.type,
      fileKey: resource.fileKey,
      fileUrl: resource.fileUrl,
      originalFileName: resource.originalFileName,
      mimeType: resource.mimeType,
      size: resource.size,
      uploaderId:
        uploader && uploader._id
          ? uploader._id.toString()
          : resource.uploaderId.toString(),
      uploader: uploader
        ? {
            id: uploader._id?.toString() ?? resource.uploaderId.toString(),
            username: uploader.username ?? '',
            fullName: uploader.fullName,
          }
        : undefined,
      createdAt: resource.createdAt.toISOString(),
      updatedAt: resource.updatedAt.toISOString(),
    };
  }

  private async removeStoredFile(fileKey: string): Promise<void> {
    await this.uploadStorageService.removeStoredFileByKey(fileKey);
  }
}
