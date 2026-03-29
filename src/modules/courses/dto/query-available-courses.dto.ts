import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';

export class QueryAvailableCoursesDto {
  @ApiPropertyOptional({ description: '搜索关键词（课程名或课程代码）' })
  @IsOptional()
  @IsString()
  keyword?: string;
}
