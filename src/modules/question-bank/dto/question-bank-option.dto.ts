import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class QuestionBankOptionDto {
  @ApiProperty({ description: '选项键值，例如 A' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(20)
  key: string;

  @ApiProperty({ description: '选项内容' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  label: string;
}
