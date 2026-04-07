import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { CoursesModule } from '../courses/courses.module';
import { CourseDiscussionsController } from './course-discussions.controller';
import { CourseDiscussionsService } from './course-discussions.service';
import {
  CourseDiscussion,
  CourseDiscussionSchema,
} from './schemas/course-discussion.schema';
import { Course, CourseSchema } from '../courses/schemas/course.schema';

@Module({
  imports: [
    CoursesModule,
    MongooseModule.forFeature([
      { name: CourseDiscussion.name, schema: CourseDiscussionSchema },
      { name: Course.name, schema: CourseSchema },
    ]),
  ],
  controllers: [CourseDiscussionsController],
  providers: [CourseDiscussionsService],
  exports: [CourseDiscussionsService],
})
export class CourseDiscussionsModule {}
