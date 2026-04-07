import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Course, CourseSchema } from '../courses/schemas/course.schema';
import { QuestionBankController } from './question-bank.controller';
import { QuestionBankService } from './question-bank.service';
import {
  QuestionBank,
  QuestionBankSchema,
} from './schemas/question-bank.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: QuestionBank.name, schema: QuestionBankSchema },
      { name: Course.name, schema: CourseSchema },
    ]),
  ],
  controllers: [QuestionBankController],
  providers: [QuestionBankService],
  exports: [QuestionBankService],
})
export class QuestionBankModule {}
