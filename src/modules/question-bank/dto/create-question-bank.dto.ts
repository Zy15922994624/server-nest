import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsDefined,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import { QuestionBankOptionDto } from './question-bank-option.dto';

export class CreateQuestionBankDto {
  @ApiProperty({ description: '题干' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(1000)
  title: string;

  @ApiPropertyOptional({ description: '补充说明' })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  description?: string;

  @ApiProperty({
    description: '题型',
    enum: ['single_choice', 'multi_choice', 'fill_text', 'rich_text'],
  })
  @IsString()
  @IsIn(['single_choice', 'multi_choice', 'fill_text', 'rich_text'])
  type: 'single_choice' | 'multi_choice' | 'fill_text' | 'rich_text';

  @ApiProperty({ description: '所属课程 ID' })
  @IsString()
  @IsNotEmpty()
  courseId: string;

  @ApiPropertyOptional({
    description: '选项列表',
    type: [QuestionBankOptionDto],
  })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(10)
  @ValidateNested({ each: true })
  @Type(() => QuestionBankOptionDto)
  options?: QuestionBankOptionDto[];

  @ApiProperty({ description: '参考答案' })
  @IsDefined()
  answer: unknown;

  @ApiPropertyOptional({ description: '题目解析' })
  @IsOptional()
  @IsString()
  @MaxLength(4000)
  analysis?: string;

  @ApiProperty({ description: '分值' })
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(1000)
  score: number;
}
