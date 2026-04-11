import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  IsBoolean,
  IsEnum,
  IsInt,
  IsOptional,
  Max,
  Min,
} from 'class-validator';
import type { NotificationType } from '../interfaces/notification-response.interface';

const notificationTypes = [
  'task_due_soon',
  'task_overdue',
  'task_graded',
] as const;

export class QueryNotificationsDto {
  @ApiPropertyOptional({ description: '页码', default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @ApiPropertyOptional({ description: '每页数量', default: 20 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  pageSize?: number;

  @ApiPropertyOptional({
    description: '通知类型',
    enum: notificationTypes,
  })
  @IsOptional()
  @IsEnum(notificationTypes)
  type?: NotificationType;

  @ApiPropertyOptional({ description: '是否已读' })
  @IsOptional()
  @Transform(({ value }) => {
    if (value === true || value === 'true') {
      return true;
    }

    if (value === false || value === 'false') {
      return false;
    }

    return undefined;
  })
  @IsBoolean()
  isRead?: boolean;
}
