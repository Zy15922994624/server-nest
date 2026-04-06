import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { CourseResourcesController } from './course-resources.controller';
import { CourseResourcesService } from './course-resources.service';
import {
  CourseResource,
  CourseResourceSchema,
} from './schemas/course-resource.schema';
import { Course, CourseSchema } from '../courses/schemas/course.schema';
import {
  CourseMember,
  CourseMemberSchema,
} from '../courses/schemas/course-member.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: CourseResource.name, schema: CourseResourceSchema },
      { name: Course.name, schema: CourseSchema },
      { name: CourseMember.name, schema: CourseMemberSchema },
    ]),
  ],
  controllers: [CourseResourcesController],
  providers: [CourseResourcesService],
  exports: [CourseResourcesService],
})
export class CourseResourcesModule {}
