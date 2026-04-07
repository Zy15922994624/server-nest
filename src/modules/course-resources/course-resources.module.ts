import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { CoursesModule } from '../courses/courses.module';
import { UploadsModule } from '../uploads/uploads.module';
import { CourseResourcesController } from './course-resources.controller';
import { CourseResourcesService } from './course-resources.service';
import {
  CourseResource,
  CourseResourceSchema,
} from './schemas/course-resource.schema';

@Module({
  imports: [
    CoursesModule,
    UploadsModule,
    MongooseModule.forFeature([
      { name: CourseResource.name, schema: CourseResourceSchema },
    ]),
  ],
  controllers: [CourseResourcesController],
  providers: [CourseResourcesService],
  exports: [CourseResourcesService],
})
export class CourseResourcesModule {}
