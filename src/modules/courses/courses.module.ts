import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
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

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Course.name, schema: CourseSchema },
      { name: CourseMember.name, schema: CourseMemberSchema },
      { name: CourseResource.name, schema: CourseResourceSchema },
    ]),
  ],
  controllers: [CoursesController],
  providers: [CoursesService],
  exports: [CoursesService],
})
export class CoursesModule {}
