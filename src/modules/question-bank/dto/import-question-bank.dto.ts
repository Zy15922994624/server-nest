import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

export class ImportQuestionBankDto {
  @ApiProperty({ description: '所属课程 ID' })
  @IsString()
  @IsNotEmpty()
  courseId: string;
}
