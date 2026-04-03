import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsOptional } from 'class-validator';

export class UploadFileQueryDto {
  @ApiPropertyOptional({
    description: '上传场景',
    enum: ['image', 'attachment'],
    default: 'attachment',
  })
  @IsOptional()
  @IsIn(['image', 'attachment'])
  scene?: 'image' | 'attachment';
}
