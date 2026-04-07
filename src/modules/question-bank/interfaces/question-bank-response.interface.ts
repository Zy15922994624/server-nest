export interface QuestionBankOwnerDto {
  id: string;
  username: string;
  fullName?: string;
}

export interface QuestionBankCourseDto {
  id: string;
  title: string;
  courseCode?: string;
}

export interface QuestionBankOptionDto {
  key: string;
  label: string;
}

export interface QuestionBankItemDto {
  id: string;
  courseId: string;
  course?: QuestionBankCourseDto;
  ownerId: string;
  owner?: QuestionBankOwnerDto;
  title: string;
  description?: string;
  type: 'single_choice' | 'multi_choice' | 'fill_text' | 'rich_text';
  options: QuestionBankOptionDto[];
  answer: unknown;
  analysis?: string;
  score: number;
  version: number;
  useCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface QuestionBankPageDto {
  items: QuestionBankItemDto[];
  total: number;
}

export interface QuestionBankImportErrorDto {
  index: number;
  title?: string;
  reason: string;
}

export interface QuestionBankImportResultDto {
  total: number;
  successCount: number;
  errorCount: number;
  items: QuestionBankItemDto[];
  errors: QuestionBankImportErrorDto[];
}
