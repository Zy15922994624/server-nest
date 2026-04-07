import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { UploadsModule } from '../uploads/uploads.module';
import { CourseCleanupService } from './course-cleanup.service';
import { CoursePermissionService } from './course-permission.service';
import { CoursesController } from './courses.controller';
import { CoursesService } from './courses.service';
import { Course, CourseSchema } from './schemas/course.schema';
import {
  CourseMember,
  CourseMemberSchema,
} from './schemas/course-member.schema';
import {
  CourseResource,
  CourseResourceSchema,
} from '../course-resources/schemas/course-resource.schema';
import {
  CourseDiscussion,
  CourseDiscussionSchema,
} from '../course-discussions/schemas/course-discussion.schema';
import {
  QuestionBank,
  QuestionBankSchema,
} from '../question-bank/schemas/question-bank.schema';

@Module({
  imports: [
    UploadsModule,
    MongooseModule.forFeature([
      { name: Course.name, schema: CourseSchema },
      { name: CourseMember.name, schema: CourseMemberSchema },
      { name: CourseResource.name, schema: CourseResourceSchema },
      { name: CourseDiscussion.name, schema: CourseDiscussionSchema },
      { name: QuestionBank.name, schema: QuestionBankSchema },
    ]),
  ],
  controllers: [CoursesController],
  providers: [CoursesService, CoursePermissionService, CourseCleanupService],
  exports: [CoursesService, CoursePermissionService],
})
export class CoursesModule {}
