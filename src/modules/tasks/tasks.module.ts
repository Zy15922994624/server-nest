import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { CoursesModule } from '../courses/courses.module';
import {
  CourseMember,
  CourseMemberSchema,
} from '../courses/schemas/course-member.schema';
import { Course, CourseSchema } from '../courses/schemas/course.schema';
import {
  CourseResource,
  CourseResourceSchema,
} from '../course-resources/schemas/course-resource.schema';
import {
  QuestionBank,
  QuestionBankSchema,
} from '../question-bank/schemas/question-bank.schema';
import { NotificationsModule } from '../notifications/notifications.module';
import { UploadsModule } from '../uploads/uploads.module';
import { UsersModule } from '../users/users.module';
import { User, UserSchema } from '../users/schemas/user.schema';
import {
  TaskAssignment,
  TaskAssignmentSchema,
} from './schemas/task-assignment.schema';
import {
  TaskQuestion,
  TaskQuestionSchema,
} from './schemas/task-question.schema';
import {
  TaskSubmission,
  TaskSubmissionSchema,
} from './schemas/task-submission.schema';
import { TaskQuestionsService } from './task-questions.service';
import { Task, TaskSchema } from './schemas/task.schema';
import { TaskPermissionService } from './task-permission.service';
import { TaskSubmissionsService } from './task-submissions.service';
import { TasksController } from './tasks.controller';
import { TasksService } from './tasks.service';

@Module({
  imports: [
    CoursesModule,
    NotificationsModule,
    UploadsModule,
    UsersModule,
    MongooseModule.forFeature([
      { name: Task.name, schema: TaskSchema },
      { name: TaskAssignment.name, schema: TaskAssignmentSchema },
      { name: TaskQuestion.name, schema: TaskQuestionSchema },
      { name: TaskSubmission.name, schema: TaskSubmissionSchema },
      { name: Course.name, schema: CourseSchema },
      { name: CourseMember.name, schema: CourseMemberSchema },
      { name: CourseResource.name, schema: CourseResourceSchema },
      { name: QuestionBank.name, schema: QuestionBankSchema },
      { name: User.name, schema: UserSchema },
    ]),
  ],
  controllers: [TasksController],
  providers: [
    TasksService,
    TaskPermissionService,
    TaskQuestionsService,
    TaskSubmissionsService,
  ],
  exports: [TasksService],
})
export class TasksModule {}
