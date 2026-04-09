import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { RolesGuard } from '../../common/guards/roles.guard';
import type { AuthUser } from '../../common/interfaces/auth-user.interface';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CreateManagedUserDto } from './dto/create-managed-user.dto';
import { QueryUsersDto } from './dto/query-users.dto';
import { UpdateManagedUserDto } from './dto/update-managed-user.dto';
import { UsersService } from './users.service';

@ApiTags('users')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('admin')
@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get()
  @ApiOperation({ summary: '获取用户列表' })
  getUsers(@Query() query: QueryUsersDto) {
    return this.usersService.getManagementList(query);
  }

  @Get('stats')
  @ApiOperation({ summary: '获取用户统计' })
  getUserStats() {
    return this.usersService.getManagementStats();
  }

  @Post()
  @ApiOperation({ summary: '创建用户' })
  createUser(@Body() payload: CreateManagedUserDto) {
    return this.usersService.createManagedUser(payload);
  }

  @Patch(':id')
  @ApiOperation({ summary: '更新用户' })
  updateUser(
    @Param('id') id: string,
    @Body() payload: UpdateManagedUserDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.usersService.updateManagedUser(id, payload, user.userId);
  }

  @Delete(':id')
  @ApiOperation({ summary: '删除用户' })
  async deleteUser(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    await this.usersService.deleteManagedUser(id, user.userId);
    return null;
  }
}
