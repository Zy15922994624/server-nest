import { ApiProperty } from '@nestjs/swagger';
import { IsBoolean } from 'class-validator';

export class SetCourseArchiveStatusDto {
  @ApiProperty({ description: '是否归档课程' })
  @IsBoolean()
  isArchived: boolean;
}
