import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsOptional, IsString, MaxLength } from 'class-validator';

export class UpdateCourseResourceDto {
  @ApiPropertyOptional({ description: '资源标题' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  title?: string;

  @ApiPropertyOptional({ description: '资源说明' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;

  @ApiPropertyOptional({
    description: '资源类型',
    enum: ['document', 'video', 'image', 'other'],
  })
  @IsOptional()
  @IsString()
  @IsIn(['document', 'video', 'image', 'other'])
  type?: 'document' | 'video' | 'image' | 'other';
}
