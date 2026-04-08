import { ApiProperty } from '@nestjs/swagger';
import {
  IsInt,
  IsMongoId,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

export class GradeTaskSubmissionDto {
  @ApiProperty({ description: '学生 ID' })
  @IsMongoId()
  studentId!: string;

  @ApiProperty({ description: '评分' })
  @IsInt()
  @Min(0)
  @Max(1000)
  score!: number;

  @ApiProperty({ description: '评分反馈', required: false })
  @IsOptional()
  @IsString()
  @MaxLength(4000)
  feedback?: string;
}
