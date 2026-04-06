import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { CourseDiscussionsController } from './course-discussions.controller';
import { CourseDiscussionsService } from './course-discussions.service';
import {
  CourseDiscussion,
  CourseDiscussionSchema,
} from './schemas/course-discussion.schema';
import { Course, CourseSchema } from '../courses/schemas/course.schema';
import {
  CourseMember,
  CourseMemberSchema,
} from '../courses/schemas/course-member.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: CourseDiscussion.name, schema: CourseDiscussionSchema },
      { name: Course.name, schema: CourseSchema },
      { name: CourseMember.name, schema: CourseMemberSchema },
    ]),
  ],
  controllers: [CourseDiscussionsController],
  providers: [CourseDiscussionsService],
  exports: [CourseDiscussionsService],
})
export class CourseDiscussionsModule {}
