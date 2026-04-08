import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsArray,
  IsOptional,
  IsString,
  MaxLength,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { TaskFileDto } from './task-file.dto';

export class SubmitTaskDto {
  @ApiPropertyOptional({ description: '提交文本内容' })
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
}
