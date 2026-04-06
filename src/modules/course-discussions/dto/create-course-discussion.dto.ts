import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class CreateCourseDiscussionDto {
  @ApiProperty({ description: '讨论标题' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  title!: string;

  @ApiProperty({ description: '讨论内容' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(5000)
  content!: string;
}
