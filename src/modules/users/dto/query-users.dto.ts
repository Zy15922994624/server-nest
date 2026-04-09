import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';
import type { UserRole } from '../../../common/interfaces/auth-user.interface';

export class QueryUsersDto {
  @ApiPropertyOptional({ description: '页码', default: 1 })
  @IsOptional()
  @IsInt()
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({ description: '每页数量', default: 10 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(100)
  pageSize?: number = 10;

  @ApiPropertyOptional({
    description: '角色筛选',
    enum: ['student', 'teacher', 'admin'],
  })
  @IsOptional()
  @IsIn(['student', 'teacher', 'admin'])
  role?: UserRole;

  @ApiPropertyOptional({ description: '按用户名、姓名或邮箱搜索' })
  @IsOptional()
  @IsString()
  search?: string;
}
