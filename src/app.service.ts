import { Injectable } from '@nestjs/common';
import { InjectConnection } from '@nestjs/mongoose';
import { Connection, ConnectionStates } from 'mongoose';

@Injectable()
export class AppService {
  constructor(@InjectConnection() private readonly connection: Connection) {}

  getHealth() {
    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
      database:
        this.connection.readyState === ConnectionStates.connected
          ? 'connected'
          : 'disconnected',
    };
  }
}
