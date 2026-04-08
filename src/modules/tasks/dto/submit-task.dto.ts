import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsArray,
  IsMongoId,
  IsOptional,
  IsString,
  MaxLength,
  ValidateNested,
} from 'class-validator';
import { TaskFileDto } from './task-file.dto';

export class SubmitTaskAnswerDto {
  @ApiProperty({ description: '任务题目 ID' })
  @IsMongoId()
  questionId!: string;

  @ApiPropertyOptional({ description: '学生作答内容' })
  @IsOptional()
  answer?: unknown;
}

export class SubmitTaskDto {
  @ApiPropertyOptional({ description: '补充文本说明' })
  @IsOptional()
  @IsString()
  @MaxLength(10000)
  content?: string;

  @ApiPropertyOptional({ description: '提交附件列表', type: [TaskFileDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => TaskFileDto)
  attachments?: TaskFileDto[];

  @ApiPropertyOptional({
    description: '结构化答题内容',
    type: [SubmitTaskAnswerDto],
  })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => SubmitTaskAnswerDto)
  answers?: SubmitTaskAnswerDto[];
}
