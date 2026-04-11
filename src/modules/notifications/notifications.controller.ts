import {
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
import { QueryNotificationsDto } from './dto/query-notifications.dto';
import { NotificationsScanService } from './notifications-scan.service';
import { NotificationsService } from './notifications.service';

@ApiTags('notifications')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('notifications')
export class NotificationsController {
  constructor(
    private readonly notificationsService: NotificationsService,
    private readonly notificationsScanService: NotificationsScanService,
  ) {}

  @Get()
  @ApiOperation({ summary: '获取当前用户通知列表' })
  getNotifications(
    @CurrentUser() user: AuthUser,
    @Query() query: QueryNotificationsDto,
  ) {
    return this.notificationsService.getNotifications(user.userId, query);
  }

  @Get('unread-count')
  @ApiOperation({ summary: '获取当前用户未读通知数量' })
  getUnreadCount(@CurrentUser() user: AuthUser) {
    return this.notificationsService.getUnreadCount(user.userId);
  }

  @Post('scan')
  @UseGuards(RolesGuard)
  @Roles('teacher', 'admin')
  @ApiOperation({ summary: '手动触发任务通知扫描' })
  scanNotifications() {
    return this.notificationsScanService.scanTasksForNotifications();
  }

  @Patch(':id/read')
  @ApiOperation({ summary: '标记单条通知为已读' })
  async markAsRead(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    await this.notificationsService.markAsRead(id, user.userId);
    return null;
  }

  @Patch('read-all')
  @ApiOperation({ summary: '标记全部通知为已读' })
  markAllAsRead(@CurrentUser() user: AuthUser) {
    return this.notificationsService.markAllAsRead(user.userId);
  }

  @Delete(':id')
  @ApiOperation({ summary: '删除通知' })
  async deleteNotification(
    @Param('id') id: string,
    @CurrentUser() user: AuthUser,
  ) {
    await this.notificationsService.deleteNotification(id, user.userId);
    return null;
  }
}
