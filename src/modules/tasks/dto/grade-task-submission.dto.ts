import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsArray,
  IsInt,
  IsMongoId,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';

export class GradeTaskAnswerDto {
  @ApiProperty({ description: '任务题目 ID' })
  @IsMongoId()
  questionId!: string;

  @ApiPropertyOptional({ description: '学生作答内容' })
  @IsOptional()
  answer?: unknown;

  @ApiPropertyOptional({ description: '教师手动评分' })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(1000)
  manualScore?: number;

  @ApiPropertyOptional({ description: '本题评语' })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  comments?: string;
}

export class GradeTaskSubmissionDto {
  @ApiProperty({ description: '学生 ID' })
  @IsMongoId()
  studentId!: string;

  @ApiPropertyOptional({ description: '总分，可用于非题目型任务' })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(1000)
  score?: number;

  @ApiPropertyOptional({ description: '总评语' })
  @IsOptional()
  @IsString()
  @MaxLength(4000)
  feedback?: string;

  @ApiPropertyOptional({
    description: '逐题批改结果',
    type: [GradeTaskAnswerDto],
  })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => GradeTaskAnswerDto)
  answers?: GradeTaskAnswerDto[];
}
