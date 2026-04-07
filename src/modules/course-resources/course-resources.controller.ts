import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Res,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { RolesGuard } from '../../common/guards/roles.guard';
import type { AuthUser } from '../../common/interfaces/auth-user.interface';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { UploadStorageService } from '../uploads/upload-storage.service';
import { CreateCourseResourceDto } from './dto/create-course-resource.dto';
import { QueryCourseResourcesDto } from './dto/query-course-resources.dto';
import { UpdateCourseResourceDto } from './dto/update-course-resource.dto';
import { CourseResourcesService } from './course-resources.service';

@ApiTags('course-resources')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('courses/:courseId/resources')
export class CourseResourcesController {
  constructor(
    private readonly courseResourcesService: CourseResourcesService,
    private readonly uploadStorageService: UploadStorageService,
  ) {}

  @Get()
  @ApiOperation({ summary: '获取课程资源列表' })
  getResources(
    @Param('courseId') courseId: string,
    @CurrentUser() user: AuthUser,
    @Query() query: QueryCourseResourcesDto,
  ) {
    return this.courseResourcesService.getResources(
      courseId,
      user.userId,
      user.role,
      query,
    );
  }

  @Post()
  @UseGuards(RolesGuard)
  @Roles('teacher', 'admin')
  @ApiOperation({ summary: '创建课程资源' })
  createResource(
    @Param('courseId') courseId: string,
    @Body() payload: CreateCourseResourceDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.courseResourcesService.createResource(
      courseId,
      payload,
      user.userId,
      user.role,
    );
  }

  @Get(':resourceId')
  @ApiOperation({ summary: '获取课程资源详情' })
  getResourceById(
    @Param('courseId') courseId: string,
    @Param('resourceId') resourceId: string,
    @CurrentUser() user: AuthUser,
  ) {
    return this.courseResourcesService.getResourceById(
      courseId,
      resourceId,
      user.userId,
      user.role,
    );
  }

  @Patch(':resourceId')
  @UseGuards(RolesGuard)
  @Roles('teacher', 'admin')
  @ApiOperation({ summary: '更新课程资源' })
  updateResource(
    @Param('courseId') courseId: string,
    @Param('resourceId') resourceId: string,
    @Body() payload: UpdateCourseResourceDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.courseResourcesService.updateResource(
      courseId,
      resourceId,
      payload,
      user.userId,
      user.role,
    );
  }

  @Delete(':resourceId')
  @UseGuards(RolesGuard)
  @Roles('teacher', 'admin')
  @ApiOperation({ summary: '删除课程资源' })
  async deleteResource(
    @Param('courseId') courseId: string,
    @Param('resourceId') resourceId: string,
    @CurrentUser() user: AuthUser,
  ) {
    await this.courseResourcesService.deleteResource(
      courseId,
      resourceId,
      user.userId,
      user.role,
    );

    return null;
  }

  @Get(':resourceId/download')
  @ApiOperation({ summary: '下载课程资源文件' })
  async downloadResource(
    @Param('courseId') courseId: string,
    @Param('resourceId') resourceId: string,
    @CurrentUser() user: AuthUser,
    @Res() response: Response,
  ) {
    const resource = await this.courseResourcesService.getResourceById(
      courseId,
      resourceId,
      user.userId,
      user.role,
    );
    const filePath = this.uploadStorageService.resolveStoredFilePath(
      resource.fileKey,
    );

    return response.download(filePath, resource.originalFileName);
  }
}
