import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { RolesGuard } from '../../common/guards/roles.guard';
import type { AuthUser } from '../../common/interfaces/auth-user.interface';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CreateCourseDto } from './dto/create-course.dto';
import { QueryAvailableCoursesDto } from './dto/query-available-courses.dto';
import { QueryCourseMembersDto } from './dto/query-course-members.dto';
import { QueryCoursesDto } from './dto/query-courses.dto';
import { SetCourseArchiveStatusDto } from './dto/set-course-archive-status.dto';
import { UpdateCourseDto } from './dto/update-course.dto';
import { CoursesService } from './courses.service';

@ApiTags('courses')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('courses')
export class CoursesController {
  constructor(private readonly coursesService: CoursesService) {}

  @Get()
  @ApiOperation({ summary: '获取课程列表' })
  getCourses(@CurrentUser() user: AuthUser, @Query() query: QueryCoursesDto) {
    return this.coursesService.getCourses(user.userId, user.role, query);
  }

  @Post()
  @UseGuards(RolesGuard)
  @Roles('teacher', 'admin')
  @ApiOperation({ summary: '创建课程' })
  createCourse(
    @CurrentUser() user: AuthUser,
    @Body() payload: CreateCourseDto,
  ) {
    return this.coursesService.createCourse(payload, user.userId);
  }

  @Get('available')
  @UseGuards(RolesGuard)
  @Roles('student')
  @ApiOperation({ summary: '获取可加入课程列表（学生）' })
  getAvailableCourses(
    @CurrentUser() user: AuthUser,
    @Query() query: QueryAvailableCoursesDto,
  ) {
    return this.coursesService.getAvailableCourses(user.userId, query.keyword);
  }

  @Get(':id')
  @ApiOperation({ summary: '获取课程详情' })
  getCourseById(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.coursesService.getCourseById(id, user.userId, user.role);
  }

  @Patch(':id')
  @UseGuards(RolesGuard)
  @Roles('teacher', 'admin')
  @ApiOperation({ summary: '更新课程' })
  updateCourse(
    @Param('id') id: string,
    @Body() payload: UpdateCourseDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.coursesService.updateCourse(
      id,
      payload,
      user.userId,
      user.role,
    );
  }

  @Patch(':id/archive')
  @UseGuards(RolesGuard)
  @Roles('teacher', 'admin')
  @ApiOperation({ summary: '设置课程归档状态' })
  async setCourseArchiveStatus(
    @Param('id') id: string,
    @Body() payload: SetCourseArchiveStatusDto,
    @CurrentUser() user: AuthUser,
  ) {
    await this.coursesService.setCourseArchiveStatus(
      id,
      user.userId,
      user.role,
      payload.isArchived,
    );
    return null;
  }

  @Delete(':id')
  @UseGuards(RolesGuard)
  @Roles('teacher', 'admin')
  @ApiOperation({ summary: '删除课程' })
  async deleteCourse(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    await this.coursesService.deleteCourse(id, user.userId, user.role);
    return null;
  }

  @Post(':id/join')
  @UseGuards(RolesGuard)
  @Roles('student')
  @ApiOperation({ summary: '加入课程（学生）' })
  async joinCourse(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    await this.coursesService.joinCourse(id, user.userId);
    return null;
  }

  @Delete(':id/leave')
  @UseGuards(RolesGuard)
  @Roles('student')
  @ApiOperation({ summary: '退出课程（学生）' })
  async leaveCourse(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    await this.coursesService.leaveCourse(id, user.userId);
    return null;
  }

  @Get(':id/members')
  @ApiOperation({ summary: '获取课程成员列表' })
  getCourseMembers(
    @Param('id') id: string,
    @CurrentUser() user: AuthUser,
    @Query() query: QueryCourseMembersDto,
  ) {
    return this.coursesService.getCourseMembers(
      id,
      user.userId,
      user.role,
      query,
    );
  }

  @Delete(':id/members/:userId')
  @UseGuards(RolesGuard)
  @Roles('teacher', 'admin')
  @ApiOperation({ summary: '移除课程成员' })
  async removeCourseMember(
    @Param('id') id: string,
    @Param('userId') targetUserId: string,
    @CurrentUser() user: AuthUser,
  ) {
    await this.coursesService.removeMember(
      id,
      targetUserId,
      user.userId,
      user.role,
    );
    return null;
  }
}
