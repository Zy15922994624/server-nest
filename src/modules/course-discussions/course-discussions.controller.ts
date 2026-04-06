import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { AuthUser } from '../../common/interfaces/auth-user.interface';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CourseDiscussionsService } from './course-discussions.service';
import { CreateCourseDiscussionReplyDto } from './dto/create-course-discussion-reply.dto';
import { CreateCourseDiscussionDto } from './dto/create-course-discussion.dto';
import { QueryCourseDiscussionRepliesDto } from './dto/query-course-discussion-replies.dto';
import { QueryCourseDiscussionsDto } from './dto/query-course-discussions.dto';

@ApiTags('course-discussions')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('courses/:courseId/discussions')
export class CourseDiscussionsController {
  constructor(
    private readonly courseDiscussionsService: CourseDiscussionsService,
  ) {}

  @Get()
  @ApiOperation({ summary: '获取课程讨论列表' })
  getDiscussions(
    @Param('courseId') courseId: string,
    @CurrentUser() user: AuthUser,
    @Query() query: QueryCourseDiscussionsDto,
  ) {
    return this.courseDiscussionsService.getDiscussions(
      courseId,
      user.userId,
      user.role,
      query,
    );
  }

  @Post()
  @ApiOperation({ summary: '发起课程讨论' })
  createDiscussion(
    @Param('courseId') courseId: string,
    @Body() payload: CreateCourseDiscussionDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.courseDiscussionsService.createDiscussion(
      courseId,
      payload,
      user.userId,
      user.role,
    );
  }

  @Get(':discussionId')
  @ApiOperation({ summary: '获取课程讨论详情' })
  getDiscussionById(
    @Param('courseId') courseId: string,
    @Param('discussionId') discussionId: string,
    @CurrentUser() user: AuthUser,
  ) {
    return this.courseDiscussionsService.getDiscussionById(
      courseId,
      discussionId,
      user.userId,
      user.role,
    );
  }

  @Get(':discussionId/replies')
  @ApiOperation({ summary: '获取讨论回复列表' })
  getDiscussionReplies(
    @Param('courseId') courseId: string,
    @Param('discussionId') discussionId: string,
    @CurrentUser() user: AuthUser,
    @Query() query: QueryCourseDiscussionRepliesDto,
  ) {
    return this.courseDiscussionsService.getDiscussionReplies(
      courseId,
      discussionId,
      user.userId,
      user.role,
      query,
    );
  }

  @Post(':discussionId/replies')
  @ApiOperation({ summary: '回复课程讨论' })
  createReply(
    @Param('courseId') courseId: string,
    @Param('discussionId') discussionId: string,
    @Body() payload: CreateCourseDiscussionReplyDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.courseDiscussionsService.createReply(
      courseId,
      discussionId,
      payload,
      user.userId,
      user.role,
    );
  }

  @Delete(':discussionId')
  @ApiOperation({ summary: '删除课程讨论' })
  async deleteDiscussion(
    @Param('courseId') courseId: string,
    @Param('discussionId') discussionId: string,
    @CurrentUser() user: AuthUser,
  ) {
    await this.courseDiscussionsService.deleteDiscussion(
      courseId,
      discussionId,
      user.userId,
      user.role,
    );

    return null;
  }

  @Delete(':discussionId/replies/:replyId')
  @ApiOperation({ summary: '删除讨论回复' })
  async deleteReply(
    @Param('courseId') courseId: string,
    @Param('discussionId') discussionId: string,
    @Param('replyId') replyId: string,
    @CurrentUser() user: AuthUser,
  ) {
    await this.courseDiscussionsService.deleteReply(
      courseId,
      discussionId,
      replyId,
      user.userId,
      user.role,
    );

    return null;
  }
}
