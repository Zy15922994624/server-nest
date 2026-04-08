import { Injectable } from '@nestjs/common';
import { InjectConnection, InjectModel } from '@nestjs/mongoose';
import { Connection, Model, Types } from 'mongoose';
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
    @InjectConnection()
    private readonly connection: Connection,
  ) {}

  async removeCourseRelations(courseId: Types.ObjectId): Promise<void> {
    type TaskCleanupRecord = {
      _id: Types.ObjectId;
      attachments?: Array<{ key?: string }>;
    };
    type SubmissionCleanupRecord = {
      attachments?: Array<{ key?: string }>;
    };

    const resources = await this.courseResourceModel.find(
      { courseId },
      { fileKey: 1 },
    );
    const tasks = await this.connection
      .collection('tasks')
      .find<TaskCleanupRecord>({ courseId }, { projection: { attachments: 1 } })
      .toArray();
    const submissions = await this.connection
      .collection('tasksubmissions')
      .find<SubmissionCleanupRecord>(
        { taskId: { $in: tasks.map((task) => task._id) } },
        { projection: { attachments: 1 } },
      )
      .toArray();
    const taskIds = tasks.map((task) => task._id);

    await Promise.all([
      this.courseMemberModel.deleteMany({ courseId }),
      this.courseResourceModel.deleteMany({ courseId }),
      this.courseDiscussionModel.deleteMany({ courseId }),
      this.questionBankModel.deleteMany({ courseId }),
      taskIds.length
        ? this.connection
            .collection('tasks')
            .deleteMany({ _id: { $in: taskIds } })
        : Promise.resolve(),
      taskIds.length
        ? this.connection
            .collection('taskassignments')
            .deleteMany({ taskId: { $in: taskIds } })
        : Promise.resolve(),
      taskIds.length
        ? this.connection
            .collection('taskquestions')
            .deleteMany({ taskId: { $in: taskIds } })
        : Promise.resolve(),
      taskIds.length
        ? this.connection
            .collection('tasksubmissions')
            .deleteMany({ taskId: { $in: taskIds } })
        : Promise.resolve(),
    ]);

    const fileKeys = [
      ...resources.map((resource) => resource.fileKey),
      ...tasks.flatMap((task) =>
        (task.attachments ?? [])
          .map((attachment) => attachment.key)
          .filter((key): key is string => Boolean(key)),
      ),
      ...submissions.flatMap((submission) =>
        (submission.attachments ?? [])
          .map((attachment) => attachment.key)
          .filter((key): key is string => Boolean(key)),
      ),
    ];

    await Promise.all(
      [...new Set(fileKeys)].map((fileKey) =>
        this.uploadStorageService.removeStoredFileByKey(fileKey),
      ),
    );
  }
}
