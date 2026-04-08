import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsInt,
  IsMongoId,
  Min,
  ValidateNested,
} from 'class-validator';

class TaskQuestionOrderDto {
  @ApiProperty({ description: '任务题目 ID' })
  @IsMongoId()
  questionId!: string;

  @ApiProperty({ description: '排序值' })
  @Type(() => Number)
  @IsInt()
  @Min(0)
  order!: number;
}

export class ReorderTaskQuestionsDto {
  @ApiProperty({ description: '题目排序列表', type: [TaskQuestionOrderDto] })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(500)
  @ValidateNested({ each: true })
  @Type(() => TaskQuestionOrderDto)
  questionOrders!: TaskQuestionOrderDto[];
}
