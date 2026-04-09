import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEmail,
  IsIn,
  IsOptional,
  IsString,
  Length,
  MaxLength,
} from 'class-validator';
import type { UserRole } from '../../../common/interfaces/auth-user.interface';

export class CreateManagedUserDto {
  @ApiProperty({ description: '用户名' })
  @IsString()
  @Length(3, 30)
  username!: string;

  @ApiProperty({ description: '邮箱' })
  @IsEmail()
  email!: string;

  @ApiProperty({ description: '密码' })
  @IsString()
  @Length(6, 50)
  password!: string;

  @ApiProperty({ description: '角色', enum: ['student', 'teacher', 'admin'] })
  @IsIn(['student', 'teacher', 'admin'])
  role!: UserRole;

  @ApiPropertyOptional({ description: '姓名' })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  fullName?: string;

  @ApiPropertyOptional({ description: '头像地址' })
  @IsOptional()
  @IsString()
  avatar?: string;
}
