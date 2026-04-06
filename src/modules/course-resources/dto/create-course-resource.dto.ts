import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsIn,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

export class CreateCourseResourceDto {
  @ApiProperty({ description: '资源标题' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  title: string;

  @ApiPropertyOptional({ description: '资源说明' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;

  @ApiProperty({
    description: '资源类型',
    enum: ['document', 'video', 'image', 'other'],
  })
  @IsString()
  @IsIn(['document', 'video', 'image', 'other'])
  type: 'document' | 'video' | 'image' | 'other';

  @ApiProperty({ description: '文件存储标识' })
  @IsString()
  @IsNotEmpty()
  fileKey: string;

  @ApiProperty({ description: '文件访问地址' })
  @IsString()
  @IsNotEmpty()
  fileUrl: string;

  @ApiProperty({ description: '原始文件名' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  originalFileName: string;

  @ApiProperty({ description: '文件 MIME 类型' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  mimeType: string;

  @ApiProperty({ description: '文件大小（字节）' })
  @IsInt()
  @Min(1)
  @Max(50 * 1024 * 1024)
  size: number;
}
