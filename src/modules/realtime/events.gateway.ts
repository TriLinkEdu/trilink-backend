import {
  WebSocketGateway,
  WebSocketServer,
  OnGatewayConnection,
  OnGatewayDisconnect,
  OnGatewayInit,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Injectable, Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';

@Injectable()
@WebSocketGateway({
  cors: { origin: '*' },
  namespace: '/',
})
export class EventsGateway implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(EventsGateway.name);

  constructor(
    private readonly jwtService: JwtService,
    private readonly config: ConfigService,
  ) {}

  afterInit() {
    this.logger.log('Events Gateway initialized');
  }

  async handleConnection(client: Socket) {
    try {
      const token = client.handshake.auth?.token || client.handshake.query?.token;
      if (!token) {
        this.logger.debug(`Client ${client.id} disconnected: no token`);
        client.disconnect();
        return;
      }

      const payload = this.jwtService.verify<{ sub?: string; type?: string }>(token, {
        secret: this.config.get<string>('jwt.secret'),
      });

      if (payload.type !== 'access') {
        this.logger.debug(`Client ${client.id} disconnected: not an access token`);
        client.disconnect();
        return;
      }

      const userId = payload.sub;
      if (!userId) {
        client.disconnect();
        return;
      }

      // Join a unique room for this user
      await client.join(`user_${userId}`);
      this.logger.debug(`User ${userId} connected as ${client.id}`);
      
      client.emit('connected', { userId, clientId: client.id });
    } catch (e) {
      this.logger.error(`Connection error: ${e.message}`);
      client.disconnect();
    }
  }

  handleDisconnect(client: Socket) {
    this.logger.debug(`Client disconnected: ${client.id}`);
  }

  emitToUser(userId: string, event: string, payload: any) {
    this.server.to(`user_${userId}`).emit(event, payload);
  }

  emitToAll(event: string, payload: any) {
    this.server.emit(event, payload);
  }

  emitToRoom(room: string, event: string, payload: any) {
    this.server.to(room).emit(event, payload);
  }
}
