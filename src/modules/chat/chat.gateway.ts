import {
  WebSocketGateway,
  WebSocketServer,
  OnGatewayConnection,
  OnGatewayDisconnect,
  OnGatewayInit,
  SubscribeMessage,
  MessageBody,
  ConnectedSocket,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Injectable, Logger, Inject, forwardRef } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { ChatService } from './chat.service';

interface AuthenticatedSocket extends Socket {
  data: {
    userId: string;
  };
}

@Injectable()
@WebSocketGateway({
  cors: {
    origin: (origin: string | undefined, cb: (err: Error | null, allow?: boolean) => void) => {
      cb(null, true);
    },
    credentials: true,
  },
  namespace: '/',
  transports: ['websocket', 'polling'],
  allowUpgrades: true,
  pingInterval: 25000,
  pingTimeout: 20000,
})
export class ChatGateway
  implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(ChatGateway.name);

  constructor(
    private readonly jwtService: JwtService,
    private readonly config: ConfigService,
    @Inject(forwardRef(() => ChatService)) private readonly chatService: ChatService,
  ) {}

  afterInit() {
    this.logger.log('ChatGateway initialized');
  }

  // ─────────────────────────────────────────────────────────────────────────
  // CONNECTION LIFECYCLE
  // ─────────────────────────────────────────────────────────────────────────

  async handleConnection(client: AuthenticatedSocket) {
    try {
      // 1) Token verification
      const token = client.handshake.auth?.token || client.handshake.query?.token;
      if (!token) {
        this.logger.warn('Socket connection rejected: no token');
        client.disconnect();
        return;
      }

      // 2) Verify JWT
      let payload: { sub?: string; type?: string };
      try {
        payload = this.jwtService.verify(token, {
          secret: this.config.get('jwt.secret'),
        });
      } catch {
        this.logger.warn('Socket connection rejected: invalid token');
        client.disconnect();
        return;
      }

      if (payload.type !== 'access' || !payload.sub) {
        this.logger.warn('Socket connection rejected: token type invalid');
        client.disconnect();
        return;
      }

      const userId = payload.sub;
      client.data.userId = userId;

      // 3) Join personal room
      await client.join(`user:${userId}`);

      // 4) Join conversation rooms (non-fatal)
      try {
        const convIds = await this.chatService.getUserConversationIds(userId);
        for (const cid of convIds) {
          await client.join(`conversation:${cid}`);
        }

        // 5) Mark online and broadcast
        await this.chatService.setOnline(userId, true);
        for (const cid of convIds) {
          this.server.to(`conversation:${cid}`).emit('presence:update', {
            userId,
            isOnline: true,
            lastSeenAt: new Date().toISOString(),
          });
        }
      } catch (err) {
        this.logger.warn(`Room join failed for ${userId}: ${err.message}`);
        // Don't disconnect - client is authenticated, rooms will be joined via conversation:join events
      }

      this.logger.log(`Socket connected: user ${userId}`);
    } catch (err) {
      this.logger.error('Socket connection error:', err.message);
      client.disconnect();
    }
  }

  async handleDisconnect(client: AuthenticatedSocket) {
    const userId = client.data?.userId;
    if (!userId) return;

    try {
      await this.chatService.setOnline(userId, false);
      const convIds = await this.chatService.getUserConversationIds(userId);
      const now = new Date().toISOString();

      for (const cid of convIds) {
        this.server.to(`conversation:${cid}`).emit('presence:update', {
          userId,
          isOnline: false,
          lastSeenAt: now,
        });
      }

      this.logger.debug(`[${client.id}] User ${userId} disconnected`);
    } catch (err) {
      this.logger.error(`Disconnect error for ${userId}: ${err.message}`);
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // CLIENT → SERVER EVENTS
  // ─────────────────────────────────────────────────────────────────────────

  @SubscribeMessage('auth:hello')
  async handleAuthHello(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() _data: { token?: string; userId?: string; name?: string },
  ) {
    const userId = client.data?.userId;
    if (!userId) return;

    const convIds = await this.chatService.getUserConversationIds(userId);
    client.emit('auth:hello', { userId, conversationIds: convIds });
  }

  @SubscribeMessage('presence:set')
  async handlePresenceSet(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() data: { userId?: string; status?: string; name?: string },
  ) {
    const userId = client.data?.userId;
    if (!userId) return;

    const isOnline = data.status !== 'offline';
    await this.chatService.setOnline(userId, isOnline);

    const convIds = await this.chatService.getUserConversationIds(userId);
    const now = new Date().toISOString();

    for (const cid of convIds) {
      this.server.to(`conversation:${cid}`).emit('presence:update', {
        userId,
        isOnline,
        lastSeenAt: now,
      });
    }
  }

  @SubscribeMessage('conversation:join')
  async handleConversationJoin(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() data: { conversationId: string; userId?: string },
  ) {
    const userId = client.data?.userId;
    if (!userId || !data.conversationId) return;

    try {
      await this.chatService.assertMember(data.conversationId, userId);
      await client.join(`conversation:${data.conversationId}`);
      this.logger.debug(`User ${userId} joined room conversation:${data.conversationId}`);
    } catch {
      // Not a member — silently ignore
    }
  }

  @SubscribeMessage('conversation:leave')
  async handleConversationLeave(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() data: { conversationId: string; userId?: string },
  ) {
    if (!data.conversationId) return;
    await client.leave(`conversation:${data.conversationId}`);
  }

  @SubscribeMessage('typing:update')
  async handleTypingUpdate(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() data: { conversationId: string; userId?: string; isTyping: boolean },
  ) {
    const userId = client.data?.userId;
    if (!userId || !data.conversationId) return;

    try {
      await this.chatService.assertMember(data.conversationId, userId);
      // Relay to room excluding sender
      client.to(`conversation:${data.conversationId}`).emit('typing:update', {
        conversationId: data.conversationId,
        userId,
        isTyping: data.isTyping,
      });
    } catch {
      // Not a member — ignore
    }
  }

  @SubscribeMessage('read:update')
  async handleReadUpdate(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() data: { conversationId: string; userId?: string; messageId: string },
  ) {
    const userId = client.data?.userId;
    if (!userId || !data.conversationId || !data.messageId) return;

    try {
      await this.chatService.upsertReadRecord(userId, data.conversationId, data.messageId);
      // Broadcast to room EXCLUDING sender so sender can update "seen" status
      client.to(`conversation:${data.conversationId}`).emit('read:update', {
        userId,
        conversationId: data.conversationId,
        lastReadMessageId: data.messageId,
      });
    } catch (err) {
      this.logger.error(`read:update error: ${err.message}`);
    }
  }

  @SubscribeMessage('ping')
  handlePing(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() data: { ts?: number },
  ) {
    client.emit('pong', { ts: Date.now(), clientTs: data?.ts });
  }

  // ─────────────────────────────────────────────────────────────────────────
  // SERVER → CLIENT HELPERS (called by ChatService via injection)
  // ─────────────────────────────────────────────────────────────────────────

  emitToConversation(conversationId: string, event: string, payload: unknown) {
    this.server.to(`conversation:${conversationId}`).emit(event, payload);
  }

  emitToUser(userId: string, event: string, payload: unknown) {
    this.server.to(`user:${userId}`).emit(event, payload);
  }
}
