import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { CoursesModule } from '../courses/courses.module';
import { Course, CourseSchema } from '../courses/schemas/course.schema';
import { QuestionBankController } from './question-bank.controller';
import { QuestionBankImportService } from './question-bank-import.service';
import { QuestionBankService } from './question-bank.service';
import { QuestionBankTemplateService } from './question-bank-template.service';
import { QuestionBankValidatorService } from './question-bank-validator.service';
import {
  QuestionBank,
  QuestionBankSchema,
} from './schemas/question-bank.schema';

@Module({
  imports: [
    CoursesModule,
    MongooseModule.forFeature([
      { name: QuestionBank.name, schema: QuestionBankSchema },
      { name: Course.name, schema: CourseSchema },
    ]),
  ],
  controllers: [QuestionBankController],
  providers: [
    QuestionBankService,
    QuestionBankImportService,
    QuestionBankTemplateService,
    QuestionBankValidatorService,
  ],
  exports: [QuestionBankService],
})
export class QuestionBankModule {}
