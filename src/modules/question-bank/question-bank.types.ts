import { CreateQuestionBankDto } from './dto/create-question-bank.dto';
import type { QuestionType } from './schemas/question-bank.schema';

export type SanitizedQuestionPayload = Partial<{
  title: string;
  description: string;
  type: QuestionType;
  options: Array<{ key: string; label: string }>;
  answer: unknown;
  analysis: string;
  score: number;
}>;

export interface ParsedQuestionImportRow {
  index: number;
  payload: CreateQuestionBankDto;
}
