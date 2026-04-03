import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

export class CreateCourseDto {
  @ApiProperty({ description: '课程标题' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  title!: string;

  @ApiPropertyOptional({ description: '课程说明' })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  description?: string;

  @ApiPropertyOptional({ description: '课程代码，例如 CS101' })
  @IsOptional()
  @IsString()
  @Matches(/^[A-Z]{2}\d{3}$/)
  courseCode?: string;

  @ApiPropertyOptional({ description: '课程封面资源标识或相对路径' })
  @IsOptional()
  @IsString()
  coverImage?: string;

  @ApiPropertyOptional({ description: '开课学期' })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  semester?: string;

  @ApiPropertyOptional({ description: '学分，范围 0-20' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(20)
  credits?: number;

  @ApiPropertyOptional({ description: '最大学生数，范围 1-500' })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(500)
  maxStudents?: number;
}
