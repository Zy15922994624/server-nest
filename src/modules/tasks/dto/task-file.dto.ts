import { ApiProperty } from '@nestjs/swagger';
import {
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

export class TaskFileDto {
  @ApiProperty({ description: '文件 key' })
  @IsString()
  @IsNotEmpty()
  key!: string;

  @ApiProperty({ description: '文件访问地址' })
  @IsString()
  @IsNotEmpty()
  url!: string;

  @ApiProperty({ description: '原始文件名' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  originalName!: string;

  @ApiProperty({ description: '文件大小（字节）' })
  @IsInt()
  @Min(1)
  @Max(50 * 1024 * 1024)
  size!: number;

  @ApiProperty({ description: '文件 MIME 类型' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  mimeType!: string;

  @ApiProperty({ description: '文件展示名称', required: false })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  name?: string;
}
