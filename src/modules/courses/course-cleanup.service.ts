import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import {
  CourseResource,
  CourseResourceDocument,
} from '../course-resources/schemas/course-resource.schema';
import {
  CourseDiscussion,
  CourseDiscussionDocument,
} from '../course-discussions/schemas/course-discussion.schema';
import {
  QuestionBank,
  QuestionBankDocument,
} from '../question-bank/schemas/question-bank.schema';
import { UploadStorageService } from '../uploads/upload-storage.service';
import {
  CourseMember,
  CourseMemberDocument,
} from './schemas/course-member.schema';

@Injectable()
export class CourseCleanupService {
  constructor(
    @InjectModel(CourseMember.name)
    private readonly courseMemberModel: Model<CourseMemberDocument>,
    @InjectModel(CourseResource.name)
    private readonly courseResourceModel: Model<CourseResourceDocument>,
    @InjectModel(CourseDiscussion.name)
    private readonly courseDiscussionModel: Model<CourseDiscussionDocument>,
    @InjectModel(QuestionBank.name)
    private readonly questionBankModel: Model<QuestionBankDocument>,
    private readonly uploadStorageService: UploadStorageService,
  ) {}

  async removeCourseRelations(courseId: Types.ObjectId): Promise<void> {
    const resources = await this.courseResourceModel.find(
      { courseId },
      { fileKey: 1 },
    );

    await Promise.all([
      this.courseMemberModel.deleteMany({ courseId }),
      this.courseResourceModel.deleteMany({ courseId }),
      this.courseDiscussionModel.deleteMany({ courseId }),
      this.questionBankModel.deleteMany({ courseId }),
    ]);

    await Promise.all(
      resources.map((resource) =>
        this.uploadStorageService.removeStoredFileByKey(resource.fileKey),
      ),
    );
  }
}
