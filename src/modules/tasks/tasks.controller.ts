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
import { AddTaskQuestionsFromBankDto } from './dto/add-task-questions-from-bank.dto';
import { CreateTaskDto } from './dto/create-task.dto';
import { GradeTaskSubmissionDto } from './dto/grade-task-submission.dto';
import { QueryTaskSubmissionsDto } from './dto/query-task-submissions.dto';
import { QueryTasksDto } from './dto/query-tasks.dto';
import { ReorderTaskQuestionsDto } from './dto/reorder-task-questions.dto';
import { SubmitTaskDto } from './dto/submit-task.dto';
import { UpdateTaskDto } from './dto/update-task.dto';
import { TaskQuestionsService } from './task-questions.service';
import { TaskSubmissionsService } from './task-submissions.service';
import { TasksService } from './tasks.service';

@ApiTags('tasks')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('tasks')
export class TasksController {
  constructor(
    private readonly tasksService: TasksService,
    private readonly taskQuestionsService: TaskQuestionsService,
    private readonly taskSubmissionsService: TaskSubmissionsService,
  ) {}

  @Get()
  @ApiOperation({ summary: '获取任务列表' })
  getTasks(@CurrentUser() user: AuthUser, @Query() query: QueryTasksDto) {
    return this.tasksService.getTasks(user.userId, user.role, query);
  }

  @Get('pending-grading')
  @UseGuards(RolesGuard)
  @Roles('teacher', 'admin')
  @ApiOperation({ summary: '获取待批改列表' })
  getPendingGrading(@CurrentUser() user: AuthUser) {
    return this.taskSubmissionsService.getPendingGrading(
      user.userId,
      user.role,
    );
  }

  @Post()
  @UseGuards(RolesGuard)
  @Roles('teacher', 'admin')
  @ApiOperation({ summary: '创建任务' })
  createTask(@CurrentUser() user: AuthUser, @Body() payload: CreateTaskDto) {
    return this.tasksService.createTask(payload, user.userId, user.role);
  }

  @Get(':id')
  @ApiOperation({ summary: '获取任务详情' })
  getTaskById(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.tasksService.getTaskById(id, user.userId, user.role);
  }

  @Patch(':id')
  @UseGuards(RolesGuard)
  @Roles('teacher', 'admin')
  @ApiOperation({ summary: '更新任务' })
  updateTask(
    @Param('id') id: string,
    @Body() payload: UpdateTaskDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.tasksService.updateTask(id, payload, user.userId, user.role);
  }

  @Delete(':id')
  @UseGuards(RolesGuard)
  @Roles('teacher', 'admin')
  @ApiOperation({ summary: '删除任务' })
  async deleteTask(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    await this.tasksService.deleteTask(id, user.userId, user.role);
    return null;
  }

  @Get(':id/questions')
  @ApiOperation({ summary: '获取任务题目列表' })
  getTaskQuestions(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.taskQuestionsService.getTaskQuestions(
      id,
      user.userId,
      user.role,
    );
  }

  @Post(':id/questions/from-bank')
  @UseGuards(RolesGuard)
  @Roles('teacher', 'admin')
  @ApiOperation({ summary: '从题库批量添加任务题目' })
  addTaskQuestionsFromBank(
    @Param('id') id: string,
    @Body() payload: AddTaskQuestionsFromBankDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.taskQuestionsService.addQuestionsFromBank(
      id,
      payload,
      user.userId,
      user.role,
    );
  }

  @Patch(':id/questions/reorder')
  @UseGuards(RolesGuard)
  @Roles('teacher', 'admin')
  @ApiOperation({ summary: '更新任务题目排序' })
  async reorderTaskQuestions(
    @Param('id') id: string,
    @Body() payload: ReorderTaskQuestionsDto,
    @CurrentUser() user: AuthUser,
  ) {
    await this.taskQuestionsService.reorderTaskQuestions(
      id,
      payload,
      user.userId,
      user.role,
    );
    return null;
  }

  @Delete('questions/:questionId')
  @UseGuards(RolesGuard)
  @Roles('teacher', 'admin')
  @ApiOperation({ summary: '删除任务题目' })
  async deleteTaskQuestion(
    @Param('questionId') questionId: string,
    @CurrentUser() user: AuthUser,
  ) {
    await this.taskQuestionsService.deleteTaskQuestion(
      questionId,
      user.userId,
      user.role,
    );
    return null;
  }

  @Get(':id/submission')
  @UseGuards(RolesGuard)
  @Roles('student')
  @ApiOperation({ summary: '获取当前学生的任务提交' })
  getCurrentSubmission(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.taskSubmissionsService.getCurrentSubmission(
      id,
      user.userId,
      user.role,
    );
  }

  @Post(':id/submission')
  @UseGuards(RolesGuard)
  @Roles('student')
  @ApiOperation({ summary: '提交任务' })
  submitTask(
    @Param('id') id: string,
    @Body() payload: SubmitTaskDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.taskSubmissionsService.submitTask(
      id,
      payload,
      user.userId,
      user.role,
    );
  }

  @Get(':id/submissions')
  @UseGuards(RolesGuard)
  @Roles('teacher', 'admin')
  @ApiOperation({ summary: '获取任务提交列表' })
  getTaskSubmissions(
    @Param('id') id: string,
    @Query() query: QueryTaskSubmissionsDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.taskSubmissionsService.getTaskSubmissions(
      id,
      user.userId,
      user.role,
      query,
    );
  }

  @Post(':id/submissions/grade')
  @UseGuards(RolesGuard)
  @Roles('teacher', 'admin')
  @ApiOperation({ summary: '评分任务提交' })
  gradeSubmission(
    @Param('id') id: string,
    @Body() payload: GradeTaskSubmissionDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.taskSubmissionsService.gradeSubmission(
      id,
      payload,
      user.userId,
      user.role,
    );
  }
}
