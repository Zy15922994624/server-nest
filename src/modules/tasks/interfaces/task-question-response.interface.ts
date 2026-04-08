export type TaskQuestionType =
  | 'single_choice'
  | 'multi_choice'
  | 'fill_text'
  | 'rich_text';

export interface TaskQuestionOptionDto {
  key: string;
  label: string;
}

export interface TaskQuestionDto {
  id: string;
  taskId: string;
  questionBankId?: string;
  type: TaskQuestionType;
  title: string;
  description?: string;
  options: TaskQuestionOptionDto[];
  answer?: unknown;
  score: number;
  order: number;
  analysis?: string;
  bankVersion?: number;
  createdAt: string;
  updatedAt: string;
}
