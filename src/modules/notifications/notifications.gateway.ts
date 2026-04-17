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

type SocketData = {
  user?: AuthUser;
};

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
    server.use((client, next) => {
      void this.authenticateClient(client)
        .then((user) => {
          (client.data as SocketData).user = user;
          next();
        })
        .catch(() => {
          next(new Error('Authentication failed'));
        });
    });
  }

  async handleConnection(client: Socket) {
    const user = (client.data as SocketData).user;

    if (!user?.userId) {
      client.disconnect(true);
      return;
    }

    await client.join(this.getUserRoom(user.userId));
    client.emit('connected', {
      message: 'connected',
      userId: user.userId,
    });

    this.logger.log(`User ${user.userId} connected to notifications gateway`);
  }

  handleDisconnect(client: Socket) {
    const user = (client.data as SocketData).user;
    if (user?.userId) {
      this.logger.log(
        `User ${user.userId} disconnected from notifications gateway`,
      );
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
      throw new Error('Token is required');
    }

    return this.jwtService.verifyAsync<AuthUser>(token);
  }

  private extractToken(client: Socket): string | null {
    const authPayload = client.handshake.auth as Record<string, unknown>;
    const authToken = authPayload.token;
    if (typeof authToken === 'string' && authToken.trim()) {
      return authToken.trim();
    }

    const headers = client.handshake.headers as Record<
      string,
      string | string[] | undefined
    >;
    const authorization = headers.authorization;
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
