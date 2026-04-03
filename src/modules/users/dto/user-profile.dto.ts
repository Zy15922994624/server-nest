import { ApiProperty } from '@nestjs/swagger';
import type { UserRole } from '../../../common/interfaces/auth-user.interface';

export class UserProfileDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  username!: string;

  @ApiProperty()
  email!: string;

  @ApiProperty({ enum: ['student', 'teacher', 'admin'] })
  role!: UserRole;

  @ApiProperty({ required: false })
  fullName?: string;

  @ApiProperty({ required: false })
  avatar?: string;

  @ApiProperty()
  createdAt!: string;

  @ApiProperty()
  updatedAt!: string;
}
