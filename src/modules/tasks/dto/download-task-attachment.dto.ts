import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

export class DownloadTaskAttachmentDto {
  @ApiProperty({ description: '任务附件文件 key' })
  @IsString()
  @IsNotEmpty()
  key!: string;
}
