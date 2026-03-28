import { WebSocketGateway, WebSocketServer, SubscribeMessage, MessageBody, ConnectedSocket } from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Logger } from '@nestjs/common';

@WebSocketGateway({ cors: { origin: '*' } })
export class ChatGateway {
  @WebSocketServer()
  server: Server;

  private readonly log = new Logger(ChatGateway.name);

  handleConnection(client: Socket) {
    this.log.debug(`Client connected ${client.id}`);
    client.emit('connected', { clientId: client.id });
  }

  @SubscribeMessage('joinRoom')
  joinRoom(@ConnectedSocket() client: Socket, @MessageBody() room: string) {
    if (typeof room === 'string' && room.length > 0) {
      client.join(room);
      return { event: 'joined', room };
    }
    return { event: 'error', message: 'Invalid room' };
  }

  @SubscribeMessage('chatBroadcast')
  broadcast(@MessageBody() payload: { room: string; text: string; sender?: string }) {
    if (payload?.room) {
      this.server.to(payload.room).emit('chatMessage', payload);
    }
    return { ok: true };
  }
}
