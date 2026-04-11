import { Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import {
  OnGatewayConnection,
  OnGatewayDisconnect,
  OnGatewayInit,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import type { Server, Socket } from 'socket.io';
import type { AuthUser } from '../../common/interfaces/auth-user.interface';
import type { NotificationItemDto } from './interfaces/notification-response.interface';

@WebSocketGateway({
  cors: {
    origin: true,
    credentials: true,
  },
  transports: ['websocket', 'polling'],
})
export class NotificationsGateway
  implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer()
  server?: Server;

  private readonly logger = new Logger(NotificationsGateway.name);

  constructor(private readonly jwtService: JwtService) {}

  afterInit(server: Server) {
    server.use(async (client, next) => {
      try {
        client.data.user = await this.authenticateClient(client);
        next();
      } catch {
        next(new Error('认证失败'));
      }
    });
  }

  async handleConnection(client: Socket) {
    const user = client.data.user as AuthUser | undefined;

    if (!user?.userId) {
      client.disconnect(true);
      return;
    }

    await client.join(this.getUserRoom(user.userId));
    client.emit('connected', {
      message: '连接成功',
      userId: user.userId,
    });

    this.logger.log(`用户 ${user.userId} 已连接通知网关`);
  }

  handleDisconnect(client: Socket) {
    const user = client.data.user as AuthUser | undefined;

    if (user?.userId) {
      this.logger.log(`用户 ${user.userId} 已断开通知网关`);
    }
  }

  emitNotificationToUser(
    userId: string,
    notification: NotificationItemDto,
  ): boolean {
    if (!this.server) {
      return false;
    }

    this.server.to(this.getUserRoom(userId)).emit('notification', notification);
    return true;
  }

  private async authenticateClient(client: Socket): Promise<AuthUser> {
    const token = this.extractToken(client);

    if (!token) {
      throw new Error('未提供认证令牌');
    }

    return this.jwtService.verifyAsync<AuthUser>(token);
  }

  private extractToken(client: Socket): string | null {
    const authToken = client.handshake.auth.token;
    if (typeof authToken === 'string' && authToken.trim()) {
      return authToken.trim();
    }

    const authorization = client.handshake.headers.authorization;
    if (
      typeof authorization === 'string' &&
      authorization.startsWith('Bearer ')
    ) {
      return authorization.slice(7).trim();
    }

    return null;
  }

  private getUserRoom(userId: string) {
    return `notifications:user:${userId}`;
  }
}
