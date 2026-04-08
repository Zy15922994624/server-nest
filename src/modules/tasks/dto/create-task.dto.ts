import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsDateString,
  IsEnum,
  IsInt,
  IsMongoId,
  IsNotEmpty,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { TaskFileDto } from './task-file.dto';

export const taskTypeValues = [
  'homework',
  'quiz',
  'project',
  'reading',
] as const;
export type TaskType = (typeof taskTypeValues)[number];

export const taskAssignmentModeValues = ['all', 'selected'] as const;
export type TaskAssignmentMode = (typeof taskAssignmentModeValues)[number];

export class CreateTaskDto {
  @ApiProperty({ description: '课程 ID' })
  @IsMongoId()
  courseId!: string;

  @ApiProperty({ description: '任务标题' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  title!: string;

  @ApiPropertyOptional({ description: '任务描述' })
  @IsOptional()
  @IsString()
  @MaxLength(4000)
  description?: string;

  @ApiProperty({ description: '任务类型', enum: taskTypeValues })
  @IsEnum(taskTypeValues)
  type!: TaskType;

  @ApiProperty({ description: '截止时间（ISO 8601）' })
  @IsDateString()
  dueDate!: string;

  @ApiPropertyOptional({ description: '总分', default: 100 })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(1000)
  totalScore?: number;

  @ApiPropertyOptional({ description: '及格分', default: 60 })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(1000)
  passingScore?: number;

  @ApiPropertyOptional({ description: '附件列表', type: [TaskFileDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => TaskFileDto)
  attachments?: TaskFileDto[];

  @ApiPropertyOptional({
    description: '关联课程资源 ID，仅阅读任务使用',
    type: [String],
  })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(50)
  @IsMongoId({ each: true })
  relatedResourceIds?: string[];

  @ApiPropertyOptional({
    description: '分配模式',
    enum: taskAssignmentModeValues,
    default: 'all',
  })
  @IsOptional()
  @IsEnum(taskAssignmentModeValues)
  assignmentMode?: TaskAssignmentMode;

  @ApiPropertyOptional({
    description: '指定学生列表，仅定向任务使用',
    type: [String],
  })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(500)
  @IsMongoId({ each: true })
  assignedStudentIds?: string[];

  @ApiPropertyOptional({ description: '是否发布', default: true })
  @IsOptional()
  @IsBoolean()
  isPublished?: boolean;

  @ApiPropertyOptional({ description: '发布时间（ISO 8601）' })
  @IsOptional()
  @IsDateString()
  publishedAt?: string;
}
