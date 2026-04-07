import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

export class QueryQuestionBankDto {
  @ApiPropertyOptional({ description: '页码', default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @ApiPropertyOptional({ description: '每页条数', default: 10 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  pageSize?: number;

  @ApiPropertyOptional({ description: '搜索题干或补充说明' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  search?: string;

  @ApiPropertyOptional({
    description: '题型筛选',
    enum: ['single_choice', 'multi_choice', 'fill_text', 'rich_text'],
  })
  @IsOptional()
  @IsString()
  @IsIn(['single_choice', 'multi_choice', 'fill_text', 'rich_text'])
  type?: 'single_choice' | 'multi_choice' | 'fill_text' | 'rich_text';

  @ApiPropertyOptional({ description: '课程 ID' })
  @IsOptional()
  @IsString()
  courseId?: string;
}
