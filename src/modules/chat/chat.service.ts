import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Inject,
  forwardRef,
  NotFoundException,
  PayloadTooLargeException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, IsNull, LessThan, Repository } from 'typeorm';
import { Conversation } from './entities/conversation.entity';
import { ConversationMember } from './entities/conversation-member.entity';
import { ChatMessage } from './entities/chat-message.entity';
import { ConversationRead } from './entities/conversation-read.entity';
import { UserBlock } from './entities/user-block.entity';
import { ParentStudent } from '../parent-students/entities/parent-student.entity';
import { User, UserRole } from '../users/entities/user.entity';
import { FileRecord } from '../files/entities/file-record.entity';
import { FilesService } from '../files/files.service';
import { ChatGateway } from './chat.gateway';
import { SendMessageDto } from './dto/send-message.dto';
import { UpdateConversationDto } from './dto/update-conversation.dto';

export interface PublicUser {
  id: string;
  firstName: string;
  lastName: string;
  role: string;
  profileImageFileId: string | null;
}

export interface ReplyPreview {
  id: string;
  senderId: string;
  senderName: string;
  text: string | null;
}

export interface EnrichedMessage {
  id: string;
  conversationId: string;
  senderId: string;
  senderName: string;
  senderAvatarFileId: string | null;
  text: string | null;
  replyToId: string | null;
  replyTo: ReplyPreview | null;
  mediaFileId: string | null;
  mediaType: string | null;
  mediaName: string | null;
  mediaMimeType: string | null;
  mediaSize: number | null;
  reactions: Record<string, string[]>;
  editedAt: string | null;
  deletedAt: string | null;
  createdAt: string;
}

export interface MemberWithUser {
  userId: string;
  role: string;
  user: PublicUser;
}

export interface EnrichedConversation {
  id: string;
  type: string;
  title: string;
  description: string | null;
  avatarFileId: string | null;
  lastMessageText: string | null;
  lastMessageAt: string | null;
  lastMessageSenderId: string | null;
  lastMessageSenderName: string | null;
  unreadCount: number;
  memberCount: number;
  members: MemberWithUser[];
  participants: PublicUser[];
  createdById: string;
  classOfferingId: string | null;
  parentVisible: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface MediaGallery {
  images: EnrichedMessage[];
  videos: EnrichedMessage[];
  audio: EnrichedMessage[];
  files: EnrichedMessage[];
}

export interface MediaUploadResult {
  fileId: string;
  url: string;
  mimeType: string;
  size: number;
  name: string;
  mediaType: string;
}

export interface MessageReadReceipt {
  messageId: string;
  userId: string;
  readAt: string;
  lastReadMessageId: string | null;
  isSender: boolean;
  user: PublicUser;
}

const DELETED_TEXT = 'This message was deleted';
const MAX_MEDIA_BYTES = 50 * 1024 * 1024; // 50 MB


@Injectable()
export class ChatService {
  constructor(
    @InjectRepository(Conversation) private readonly convRepo: Repository<Conversation>,
    @InjectRepository(ConversationMember) private readonly memRepo: Repository<ConversationMember>,
    @InjectRepository(ChatMessage) private readonly msgRepo: Repository<ChatMessage>,
    @InjectRepository(ConversationRead) private readonly readRepo: Repository<ConversationRead>,
    @InjectRepository(UserBlock) private readonly blockRepo: Repository<UserBlock>,
    @InjectRepository(ParentStudent) private readonly psRepo: Repository<ParentStudent>,
    @InjectRepository(FileRecord) private readonly fileRepo: Repository<FileRecord>,
    private readonly filesService: FilesService,
    @Inject(forwardRef(() => ChatGateway)) private readonly gateway: ChatGateway,
  ) {}

  // ─────────────────────────────────────────────────────────────────────────
  // HELPERS
  // ─────────────────────────────────────────────────────────────────────────

  private toPublicUser(u: User): PublicUser {
    return {
      id: u.id,
      firstName: u.firstName,
      lastName: u.lastName,
      role: u.role,
      profileImageFileId: u.profileImageFileId ?? null,
    };
  }

  private buildEnrichedMessage(
    msg: ChatMessage,
    userMap: Map<string, User>,
    replyMsg?: ChatMessage | null,
  ): EnrichedMessage {
    const sender = userMap.get(msg.senderId);
    const senderName = sender ? `${sender.firstName} ${sender.lastName}` : 'Unknown';
    const senderAvatarFileId = sender?.profileImageFileId ?? null;

    const isDeleted = !!msg.deletedAt;

    let replyTo: ReplyPreview | null = null;
    if (replyMsg) {
      const replySender = userMap.get(replyMsg.senderId);
      replyTo = {
        id: replyMsg.id,
        senderId: replyMsg.senderId,
        senderName: replySender ? `${replySender.firstName} ${replySender.lastName}` : 'Unknown',
        text: replyMsg.deletedAt ? DELETED_TEXT : replyMsg.text,
      };
    }

    return {
      id: msg.id,
      conversationId: msg.conversationId,
      senderId: msg.senderId,
      senderName,
      senderAvatarFileId,
      text: isDeleted ? null : msg.text,
      replyToId: msg.replyToId ?? null,
      replyTo,
      mediaFileId: isDeleted ? null : (msg.mediaFileId ?? null),
      mediaType: isDeleted ? null : (msg.mediaType ?? null),
      mediaName: isDeleted ? null : (msg.mediaName ?? null),
      mediaMimeType: isDeleted ? null : (msg.mediaMimeType ?? null),
      mediaSize: isDeleted ? null : (msg.mediaSize ?? null),
      reactions: msg.reactions ?? {},
      editedAt: msg.editedAt ? msg.editedAt.toISOString() : null,
      deletedAt: msg.deletedAt ? msg.deletedAt.toISOString() : null,
      createdAt: msg.createdAt.toISOString(),
    };
  }

  private async buildUserMap(userIds: string[]): Promise<Map<string, User>> {
    if (!userIds.length) return new Map();
    const uniq = [...new Set(userIds)];
    const users = await this.convRepo.manager.getRepository(User).find({ where: { id: In(uniq) } });
    return new Map(users.map((u) => [u.id, u]));
  }

  private deriveMediaType(mimeType: string): string {
    if (mimeType.startsWith('image/')) return 'image';
    if (mimeType.startsWith('video/')) return 'video';
    if (mimeType.startsWith('audio/')) return 'audio';
    return 'file';
  }

  async assertMember(conversationId: string, userId: string): Promise<ConversationMember> {
    const m = await this.memRepo.findOne({ where: { conversationId, userId } });
    if (!m) throw new ForbiddenException('Not a member of this conversation');
    return m;
  }

  async assertAdminMember(conversationId: string, userId: string): Promise<ConversationMember> {
    const m = await this.assertMember(conversationId, userId);
    if (m.role !== 'admin') throw new ForbiddenException('Admin role required');
    return m;
  }

  async assertReadAccess(conversationId: string, user: User): Promise<void> {
    if (user.role === UserRole.ADMIN) return;
    const m = await this.memRepo.findOne({ where: { conversationId, userId: user.id } });
    if (m) return;
    if (user.role !== UserRole.PARENT) throw new ForbiddenException('Not a member');
    const members = await this.memRepo.find({ where: { conversationId } });
    const linkedChildIds = (await this.psRepo.find({ where: { parentId: user.id } })).map((l) => l.studentId);
    if (!members.some((mem) => linkedChildIds.includes(mem.userId))) {
      throw new ForbiddenException('Not a member');
    }
  }

  private async buildConversationPayload(
    conv: Conversation,
    userId: string,
  ): Promise<EnrichedConversation> {
    const members = await this.memRepo.find({ where: { conversationId: conv.id } });
    const memberCount = members.length;

    const allUserIds = members.map((m) => m.userId);
    const userMap = await this.buildUserMap(allUserIds);

    // First 5 members with user info
    const first5 = members.slice(0, 5).map((m) => ({
      userId: m.userId,
      role: m.role,
      user: userMap.has(m.userId)
        ? this.toPublicUser(userMap.get(m.userId)!)
        : { id: m.userId, firstName: 'Unknown', lastName: '', role: 'member', profileImageFileId: null },
    }));

    // Participants for DM
    const participants: PublicUser[] = conv.type === 'direct'
      ? members.map((m) => userMap.has(m.userId)
          ? this.toPublicUser(userMap.get(m.userId)!)
          : { id: m.userId, firstName: 'Unknown', lastName: '', role: 'member', profileImageFileId: null })
      : [];

    // Unread count
    const readRecord = await this.readRepo.findOne({ where: { userId, conversationId: conv.id } });
    let unreadCount = 0;
    if (readRecord?.lastReadAt) {
      unreadCount = await this.msgRepo.count({
        where: {
          conversationId: conv.id,
          createdAt: LessThan(new Date()) as any,
          deletedAt: IsNull(),
        },
      });
      // More precise: count messages after lastReadAt not sent by user
      const qb = this.msgRepo.createQueryBuilder('m')
        .where('m.conversation_id = :cid', { cid: conv.id })
        .andWhere('m.created_at > :since', { since: readRecord.lastReadAt })
        .andWhere('m.sender_id != :uid', { uid: userId })
        .andWhere('m.deleted_at IS NULL');
      unreadCount = await qb.getCount();
    } else {
      // No read record — count all messages not sent by user
      const qb = this.msgRepo.createQueryBuilder('m')
        .where('m.conversation_id = :cid', { cid: conv.id })
        .andWhere('m.sender_id != :uid', { uid: userId })
        .andWhere('m.deleted_at IS NULL');
      unreadCount = await qb.getCount();
    }

    // Last message sender name
    let lastMessageSenderName: string | null = null;
    if (conv.lastMessageSenderId && userMap.has(conv.lastMessageSenderId)) {
      const s = userMap.get(conv.lastMessageSenderId)!;
      lastMessageSenderName = `${s.firstName} ${s.lastName}`;
    }

    return {
      id: conv.id,
      type: conv.type,
      title: conv.title,
      description: conv.description ?? null,
      avatarFileId: conv.avatarFileId ?? null,
      lastMessageText: conv.lastMessageText ?? null,
      lastMessageAt: conv.lastMessageAt ? conv.lastMessageAt.toISOString() : null,
      lastMessageSenderId: conv.lastMessageSenderId ?? null,
      lastMessageSenderName,
      unreadCount,
      memberCount,
      members: first5,
      participants,
      createdById: conv.createdById,
      classOfferingId: conv.classOfferingId ?? null,
      parentVisible: conv.parentVisible,
      createdAt: conv.createdAt.toISOString(),
      updatedAt: conv.updatedAt.toISOString(),
    };
  }

  private async emitConversationUpdate(conversationId: string): Promise<void> {
    const conv = await this.convRepo.findOne({ where: { id: conversationId } });
    if (!conv) return;

    const members = await this.memRepo.find({ where: { conversationId } });
    for (const member of members) {
      const payload = await this.buildConversationPayload(conv, member.userId);
      this.gateway.emitToUser(member.userId, 'conversation:update', payload);
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // MESSAGE OPERATIONS
  // ─────────────────────────────────────────────────────────────────────────

  async sendMessage(
    conversationId: string,
    senderId: string,
    dto: SendMessageDto,
  ): Promise<EnrichedMessage> {
    await this.assertMember(conversationId, senderId);

    if (!dto.text && !dto.mediaFileId) {
      throw new BadRequestException('Message must have text or media');
    }

    const conv = await this.convRepo.findOne({ where: { id: conversationId } });
    if (!conv) throw new NotFoundException('Conversation not found');

    // Block check for DMs
    if (conv.type === 'direct') {
      const members = await this.memRepo.find({ where: { conversationId } });
      const recipientId = members.find((m) => m.userId !== senderId)?.userId;
      if (recipientId) {
        const blocked = await this.blockRepo.findOne({
          where: { blockerId: recipientId, blockedId: senderId },
        });
        if (blocked) throw new ForbiddenException('You have been blocked by this user');
      }
    }

    // Validate replyToId
    if (dto.replyToId) {
      const replyMsg = await this.msgRepo.findOne({ where: { id: dto.replyToId } });
      if (!replyMsg || replyMsg.conversationId !== conversationId) {
        throw new BadRequestException('Invalid replyToId: message not in this conversation');
      }
    }

    // Validate mediaFileId
    let mediaType: string | null = null;
    let mediaName: string | null = null;
    let mediaMimeType: string | null = null;
    let mediaSize: number | null = null;

    if (dto.mediaFileId) {
      const fileRec = await this.fileRepo.findOne({ where: { id: dto.mediaFileId } });
      if (!fileRec || fileRec.uploadedById !== senderId) {
        throw new BadRequestException('Invalid mediaFileId');
      }
      mediaMimeType = fileRec.mime;
      mediaType = this.deriveMediaType(fileRec.mime);
      mediaName = fileRec.filename;
      mediaSize = fileRec.sizeBytes ? Number(fileRec.sizeBytes) : null;
    }

    const msg = await this.msgRepo.save(
      this.msgRepo.create({
        conversationId,
        senderId,
        text: dto.text ?? null,
        replyToId: dto.replyToId ?? null,
        mediaFileId: dto.mediaFileId ?? null,
        mediaType,
        mediaName,
        mediaMimeType,
        mediaSize,
        reactions: {},
      }),
    );

    // Update conversation last message
    await this.convRepo.update(conversationId, {
      lastMessageText: dto.text ? dto.text.substring(0, 500) : `[${mediaType ?? 'file'}]`,
      lastMessageAt: msg.createdAt,
      lastMessageSenderId: senderId,
    });

    let replyMsg: ChatMessage | null = null;
    if (dto.replyToId) {
      replyMsg = await this.msgRepo.findOne({ where: { id: dto.replyToId } }) ?? null;
    }

    const userMap = await this.buildUserMap([
      senderId,
      ...(replyMsg?.senderId ? [replyMsg.senderId] : []),
    ]);

    const enrichedSend = this.buildEnrichedMessage(msg, userMap, replyMsg);

    // Fan out via Socket.IO — wrap in { conversationId, message } as the frontend expects
    this.gateway.emitToConversation(conversationId, 'message:new', {
      conversationId,
      message: enrichedSend,
    });

    // Also emit conversation:update so list panels refresh (per-user payloads)
    await this.emitConversationUpdate(conversationId);

    return enrichedSend;
  }

  async editMessage(
    conversationId: string,
    msgId: string,
    userId: string,
    text: string,
  ): Promise<EnrichedMessage> {
    const msg = await this.msgRepo.findOne({ where: { id: msgId, conversationId } });
    if (!msg) throw new NotFoundException('Message not found');
    if (msg.senderId !== userId) throw new ForbiddenException('Only the sender can edit this message');
    if (msg.deletedAt) throw new BadRequestException('Cannot edit a deleted message');

    msg.text = text;
    msg.editedAt = new Date();
    await this.msgRepo.save(msg);

    const userMap = await this.buildUserMap([msg.senderId]);
    let replyMsg: ChatMessage | null = null;
    if (msg.replyToId) {
      replyMsg = await this.msgRepo.findOne({ where: { id: msg.replyToId } }) ?? null;
      if (replyMsg) {
        const replyUserMap = await this.buildUserMap([replyMsg.senderId]);
        replyUserMap.forEach((v, k) => userMap.set(k, v));
      }
    }
    const enrichedEdit = this.buildEnrichedMessage(msg, userMap, replyMsg);
    this.gateway.emitToConversation(msg.conversationId, 'message:update', enrichedEdit);
    return enrichedEdit;
  }

  async deleteMessage(
    conversationId: string,
    msgId: string,
    userId: string,
    userRole: UserRole,
  ): Promise<EnrichedMessage> {
    const msg = await this.msgRepo.findOne({ where: { id: msgId, conversationId } });
    if (!msg) throw new NotFoundException('Message not found');

    const isAdmin = userRole === UserRole.ADMIN;
    const convMember = await this.memRepo.findOne({ where: { conversationId, userId } });
    const isConvAdmin = convMember?.role === 'admin';

    if (msg.senderId !== userId && !isAdmin && !isConvAdmin) {
      throw new ForbiddenException('Not authorized to delete this message');
    }

    msg.deletedAt = new Date();
    await this.msgRepo.save(msg);

    const userMap = await this.buildUserMap([msg.senderId]);
    const enrichedDel = this.buildEnrichedMessage(msg, userMap, null);
    this.gateway.emitToConversation(msg.conversationId, 'message:update', enrichedDel);
    return enrichedDel;
  }

  async toggleReaction(
    conversationId: string,
    msgId: string,
    userId: string,
    emoji: string,
  ): Promise<EnrichedMessage> {
    await this.assertMember(conversationId, userId);
    const msg = await this.msgRepo.findOne({ where: { id: msgId, conversationId } });
    if (!msg) throw new NotFoundException('Message not found');
    if (msg.deletedAt) throw new BadRequestException('Cannot react to a deleted message');

    const reactions: Record<string, string[]> = msg.reactions ?? {};
    const users: string[] = reactions[emoji] ?? [];

    if (users.includes(userId)) {
      const updated = users.filter((id) => id !== userId);
      if (updated.length === 0) {
        delete reactions[emoji];
      } else {
        reactions[emoji] = updated;
      }
    } else {
      reactions[emoji] = [...users, userId];
    }

    msg.reactions = reactions;
    await this.msgRepo.save(msg);

    const userMapReact = await this.buildUserMap([msg.senderId]);
    const enrichedReact = this.buildEnrichedMessage(msg, userMapReact, null);
    this.gateway.emitToConversation(msg.conversationId, 'message:update', enrichedReact);
    return enrichedReact;
  }

  async markRead(
    conversationId: string,
    userId: string,
    messageId: string,
  ): Promise<void> {
    await this.upsertReadRecord(userId, conversationId, messageId);
  }

  async listMessages(
    conversationId: string,
    user: User,
    limit = 50,
    before?: string,
  ): Promise<{ messages: EnrichedMessage[]; hasMore: boolean }> {
    await this.assertReadAccess(conversationId, user);

    const safeLimit = Math.min(Math.max(limit, 1), 100);
    const qb = this.msgRepo
      .createQueryBuilder('m')
      .where('m.conversation_id = :cid', { cid: conversationId })
      .orderBy('m.created_at', 'DESC')
      .take(safeLimit + 1);
    if (before) {
      const cursor = await this.msgRepo.findOne({ where: { id: before } });
      if (!cursor) throw new BadRequestException('Invalid before cursor');
      if (cursor.conversationId !== conversationId) {
        throw new BadRequestException('Cursor message does not belong to this conversation');
      }
      qb.andWhere('m.created_at < :cursorDate', { cursorDate: cursor.createdAt });
    }

    const rows = await qb.getMany();
    const hasMore = rows.length > safeLimit;
    const messages = rows.slice(0, safeLimit);

    const member = await this.memRepo.findOne({ where: { conversationId, userId: user.id } });
    const latestReadable = messages.find((m) => m.senderId !== user.id) ?? messages[0];
    if (member && latestReadable) {
      await this.upsertReadRecord(user.id, conversationId, latestReadable.id);
    }

    const senderIds = [...new Set(messages.map((m) => m.senderId))];
    const replyIds = messages.filter((m) => m.replyToId).map((m) => m.replyToId!);
    const allIds = [...new Set([...senderIds, ...replyIds])];
    const userMap = await this.buildUserMap(allIds);

    const replyMsgs = replyIds.length
      ? await this.msgRepo.find({ where: { id: In(replyIds) } })
      : [];
    const replyMap = new Map(replyMsgs.map((r) => [r.id, r]));

    const replySenderIds = replyMsgs.map((r) => r.senderId);
    const replyUserMap = await this.buildUserMap(replySenderIds);
    replyUserMap.forEach((v, k) => userMap.set(k, v));

    // DB query returns newest-first; reverse to oldest-first for the frontend
    const enrichedMessages = messages
      .map((m) => this.buildEnrichedMessage(m, userMap, m.replyToId ? replyMap.get(m.replyToId) ?? null : null))
      .reverse();

    return {
      messages: enrichedMessages,
      hasMore,
    };
  }

  async createConversation(
    body: Pick<Conversation, 'type' | 'title' | 'classOfferingId' | 'parentVisible' | 'createdById'> & { description?: string },
    memberIds: string[],
  ): Promise<EnrichedConversation> {
    const conv = await this.convRepo.save(
      this.convRepo.create({
        ...body,
        description: body.description ?? null,
      }),
    );
    const uniq = [...new Set([body.createdById, ...memberIds])];
    for (const uid of uniq) {
      const role = uid === body.createdById ? 'admin' : 'member';
      await this.memRepo.save(this.memRepo.create({ conversationId: conv.id, userId: uid, role }));
    }
    return this.buildConversationPayload(conv, body.createdById);
  }

  async listConversations(userId: string, role: UserRole): Promise<EnrichedConversation[]> {
    const mems = await this.memRepo.find({ where: { userId } });
    const fromMember = mems.map((m) => m.conversationId);
    let extra: string[] = [];

    if (role === UserRole.PARENT) {
      const links = await this.psRepo.find({ where: { parentId: userId } });
      const childIds = links.map((l) => l.studentId);
      if (childIds.length) {
        const childMems = await this.memRepo.find({ where: { userId: In(childIds) } });
        extra = [...new Set(childMems.map((m) => m.conversationId))];
      }
    }

    const all = [...new Set([...fromMember, ...extra])];
    if (!all.length) return [];

    const convs = await this.convRepo.find({
      where: { id: In(all) },
      order: { lastMessageAt: 'DESC', updatedAt: 'DESC' },
    });

    return Promise.all(convs.map((c) => this.buildConversationPayload(c, userId)));
  }

  async getConversation(id: string, user: User): Promise<EnrichedConversation> {
    await this.assertReadAccess(id, user);
    const conv = await this.convRepo.findOne({ where: { id } });
    if (!conv) throw new NotFoundException('Conversation not found');
    return this.buildConversationPayload(conv, user.id);
  }

  async updateConversation(
    id: string,
    userId: string,
    dto: UpdateConversationDto,
  ): Promise<EnrichedConversation> {
    await this.assertAdminMember(id, userId);
    const conv = await this.convRepo.findOne({ where: { id } });
    if (!conv) throw new NotFoundException('Conversation not found');

    if (dto.title !== undefined) conv.title = dto.title;
    if (dto.description !== undefined) conv.description = dto.description;
    if (dto.avatarFileId !== undefined) conv.avatarFileId = dto.avatarFileId;

    await this.convRepo.save(conv);
    const updated = await this.buildConversationPayload(conv, userId);
    await this.emitConversationUpdate(id);
    return updated;
  }

  async getMediaGallery(conversationId: string, userId: string): Promise<MediaGallery> {
    await this.assertMember(conversationId, userId);

    const msgs = await this.msgRepo.find({
      where: { conversationId, deletedAt: IsNull() },
      order: { createdAt: 'DESC' },
    });

    const mediaMsgs = msgs.filter((m) => m.mediaFileId);
    const senderIds = [...new Set(mediaMsgs.map((m) => m.senderId))];
    const userMap = await this.buildUserMap(senderIds);

    const enriched = mediaMsgs.map((m) => this.buildEnrichedMessage(m, userMap, null));

    return {
      images: enriched.filter((m) => m.mediaType === 'image'),
      videos: enriched.filter((m) => m.mediaType === 'video'),
      audio: enriched.filter((m) => m.mediaType === 'audio'),
      files: enriched.filter((m) => m.mediaType === 'file'),
    };
  }

  // ─────────────────────────────────────────────────────────────────────────
  // MEMBER MANAGEMENT
  // ─────────────────────────────────────────────────────────────────────────

  async listMembers(conversationId: string, userId: string): Promise<MemberWithUser[]> {
    await this.assertMember(conversationId, userId);
    const members = await this.memRepo.find({ where: { conversationId } });
    const userMap = await this.buildUserMap(members.map((m) => m.userId));

    return members.map((m) => ({
      userId: m.userId,
      role: m.role,
      user: userMap.has(m.userId)
        ? this.toPublicUser(userMap.get(m.userId)!)
        : { id: m.userId, firstName: 'Unknown', lastName: '', role: 'member', profileImageFileId: null },
    }));
  }

  async addMembers(conversationId: string, adminId: string, userIds: string[]): Promise<void> {
    await this.assertAdminMember(conversationId, adminId);
    for (const uid of userIds) {
      const exists = await this.memRepo.findOne({ where: { conversationId, userId: uid } });
      if (!exists) {
        await this.memRepo.save(this.memRepo.create({ conversationId, userId: uid, role: 'member' }));
      }
    }
  }

  async removeMember(conversationId: string, requesterId: string, targetUserId: string): Promise<void> {
    const requester = await this.memRepo.findOne({ where: { conversationId, userId: requesterId } });
    if (!requester) throw new ForbiddenException('Not a member');

    // Admin can remove anyone; members can only remove themselves
    if (requester.role !== 'admin' && requesterId !== targetUserId) {
      throw new ForbiddenException('Admin role required to remove other members');
    }

    await this.memRepo.delete({ conversationId, userId: targetUserId });

    await this.emitConversationUpdate(conversationId);
  }

  // ─────────────────────────────────────────────────────────────────────────
  // BLOCK SYSTEM
  // ─────────────────────────────────────────────────────────────────────────

  async blockUser(blockerId: string, blockedId: string): Promise<void> {
    if (blockerId === blockedId) throw new BadRequestException('Cannot block yourself');
    const exists = await this.blockRepo.findOne({ where: { blockerId, blockedId } });
    if (!exists) {
      await this.blockRepo.save(this.blockRepo.create({ blockerId, blockedId }));
    }
  }

  async unblockUser(blockerId: string, blockedId: string): Promise<void> {
    await this.blockRepo.delete({ blockerId, blockedId });
  }

  async listBlocked(userId: string): Promise<PublicUser[]> {
    const blocks = await this.blockRepo.find({ where: { blockerId: userId } });
    if (!blocks.length) return [];
    const userMap = await this.buildUserMap(blocks.map((b) => b.blockedId));
    return blocks
      .filter((b) => userMap.has(b.blockedId))
      .map((b) => this.toPublicUser(userMap.get(b.blockedId)!));
  }

  // ─────────────────────────────────────────────────────────────────────────
  // PRESENCE
  // ─────────────────────────────────────────────────────────────────────────

  async getPresence(userIds: string[]): Promise<Record<string, { isOnline: boolean; lastSeenAt: string | null }>> {
    if (userIds.length > 100) throw new BadRequestException('Maximum 100 userIds allowed');
    if (!userIds.length) return {};
    const users = await this.convRepo.manager
      .getRepository(User)
      .find({ where: { id: In(userIds) } });

    const result: Record<string, { isOnline: boolean; lastSeenAt: string | null }> = {};
    for (const u of users) {
      result[u.id] = {
        isOnline: u.isOnline ?? false,
        lastSeenAt: u.lastSeenAt ? u.lastSeenAt.toISOString() : null,
      };
    }
    return result;
  }

  async setOnline(userId: string, isOnline: boolean): Promise<void> {
    await this.convRepo.manager
      .getRepository(User)
      .update(userId, { isOnline, lastSeenAt: new Date() });
  }

  async getUserConversationIds(userId: string): Promise<string[]> {
    const mems = await this.memRepo.find({ where: { userId } });
    return mems.map((m) => m.conversationId);
  }

  async upsertReadRecord(userId: string, conversationId: string, messageId: string): Promise<void> {
    await this.assertMember(conversationId, userId);
    const msg = await this.msgRepo.findOne({ where: { id: messageId, conversationId } });
    if (!msg) throw new NotFoundException('Message not found');

    await this.readRepo
      .createQueryBuilder()
      .insert()
      .into(ConversationRead)
      .values({
        userId,
        conversationId,
        lastReadMessageId: messageId,
        lastReadAt: new Date(),
      })
      .orUpdate(['last_read_message_id', 'last_read_at'], ['user_id', 'conversation_id'])
      .execute();

    // Emit to all OTHER members so they can show "seen" ticks
    // (the reader themselves doesn't need to receive their own read receipt)
    const members = await this.memRepo.find({ where: { conversationId } });
    for (const member of members) {
      if (member.userId === userId) continue;
      this.gateway.emitToUser(member.userId, 'read:update', {
        userId,
        conversationId,
        lastReadMessageId: messageId,
      });
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // MEDIA UPLOAD
  // ─────────────────────────────────────────────────────────────────────────

  async uploadChatMedia(file: Express.Multer.File, userId: string): Promise<MediaUploadResult> {
    if (!file) throw new BadRequestException('No file provided');
    if (file.size > MAX_MEDIA_BYTES) {
      throw new PayloadTooLargeException('File exceeds 50 MB limit');
    }

    const record = await this.filesService.uploadFile(file, userId);
    const mediaType = this.deriveMediaType(record.mime);

    return {
      fileId: record.id,
      url: record.path,
      mimeType: record.mime,
      size: record.sizeBytes ? Number(record.sizeBytes) : file.size,
      name: record.filename,
      mediaType,
    };
  }

  // ─────────────────────────────────────────────────────────────────────────
  // LEGACY / COMPAT METHODS (kept for backward compatibility)
  // ─────────────────────────────────────────────────────────────────────────

  async postMessage(conversationId: string, senderId: string, text: string): Promise<EnrichedMessage> {
    return this.sendMessage(conversationId, senderId, { text });
  }

  async listMessages_legacy(conversationId: string, user: User, limit = 50, skip = 0) {
    await this.assertReadAccess(conversationId, user);
    const msgs = await this.msgRepo.find({
      where: { conversationId },
      order: { createdAt: 'DESC' },
      take: limit,
      skip,
    });
    const userMap = await this.buildUserMap(msgs.map((m) => m.senderId));
    return msgs.map((m) => this.buildEnrichedMessage(m, userMap, null));
  }

  async getReadReceipts(messageId: string, user: User): Promise<MessageReadReceipt[]> {
    const msg = await this.msgRepo.findOne({ where: { id: messageId } });
    if (!msg) return [];
    await this.assertReadAccess(msg.conversationId, user);

    const members = await this.memRepo.find({ where: { conversationId: msg.conversationId } });
    const reads = await this.readRepo.find({ where: { conversationId: msg.conversationId } });
    const readMap = new Map(reads.map((r) => [r.userId, r]));
    const userMap = await this.buildUserMap(members.map((m) => m.userId));

    return members.flatMap((m): MessageReadReceipt[] => {
      const memberUser = userMap.get(m.userId);
      if (!memberUser) return [];

      if (m.userId === msg.senderId) {
        return [{
          messageId: msg.id,
          userId: m.userId,
          readAt: msg.createdAt.toISOString(),
          lastReadMessageId: msg.id,
          isSender: true,
          user: this.toPublicUser(memberUser),
        }];
      }

      const read = readMap.get(m.userId);
      if (!read || read.lastReadAt < msg.createdAt) return [];

      return [{
        messageId: msg.id,
        userId: m.userId,
        readAt: read.lastReadAt.toISOString(),
        lastReadMessageId: read.lastReadMessageId,
        isSender: false,
        user: this.toPublicUser(memberUser),
      }];
    });
  }

  async searchUsers(user: User, searchTerm: string) {
    const userRepo = this.convRepo.manager.getRepository(User);
    const qb = userRepo.createQueryBuilder('u');
    qb.where('u.id != :currentUserId', { currentUserId: user.id });

    if (searchTerm) {
      qb.andWhere('(u.firstName ILIKE :term OR u.lastName ILIKE :term OR u.subject ILIKE :term)', {
        term: `%${searchTerm}%`,
      });
    }

    if (user.role === UserRole.STUDENT) {
      qb.andWhere(
        '(u.role = :teacherRole OR (u.role = :studentRole AND u.grade = :userGrade))',
        {
          teacherRole: UserRole.TEACHER,
          studentRole: UserRole.STUDENT,
          userGrade: user.grade,
        },
      );
    }

    if (user.role === UserRole.PARENT) {
      qb.andWhere('u.role IN (:...allowedRoles)', {
        allowedRoles: [UserRole.TEACHER, UserRole.ADMIN],
      });
    }

    qb.select([
      'u.id',
      'u.firstName',
      'u.lastName',
      'u.role',
      'u.subject',
      'u.grade',
      'u.section',
      'u.profileImageFileId',
      'u.childName',
    ]);
    qb.orderBy('u.role', 'ASC').addOrderBy('u.firstName', 'ASC');
    qb.take(20);
    return qb.getMany();
  }

  async setAllParentVisible() {
    const result = await this.convRepo
      .createQueryBuilder()
      .update()
      .set({ parentVisible: true })
      .where('parent_visible = :v', { v: false })
      .execute();
    return { updated: result.affected ?? 0, message: 'All conversations are now visible to parents.' };
  }

  async listAllConversations(take = 50, skip = 0) {
    return this.convRepo.find({ order: { updatedAt: 'DESC' }, take, skip });
  }

  async listChildConversations(parentId: string, studentId: string) {
    const link = await this.psRepo.findOne({ where: { parentId, studentId } });
    if (!link) throw new ForbiddenException('Not linked to this student');
    const mems = await this.memRepo.find({ where: { userId: studentId } });
    if (!mems.length) return [];
    return this.convRepo.find({ where: { id: In(mems.map((m) => m.conversationId)) }, order: { updatedAt: 'DESC' } });
  }

  async listChildConversationMessages(parentId: string, studentId: string, conversationId: string, limit = 50, skip = 0) {
    const link = await this.psRepo.findOne({ where: { parentId, studentId } });
    if (!link) throw new ForbiddenException('Not linked to this student');
    const mem = await this.memRepo.findOne({ where: { conversationId, userId: studentId } });
    if (!mem) throw new ForbiddenException('Child is not a member of this conversation');
    const messages = await this.msgRepo.find({
      where: { conversationId },
      order: { createdAt: 'DESC' },
      take: limit,
      skip,
    });
    return { conversationId, messages };
  }

  async initiateDirectChat(initiatorId: string, targetUserId: string, initiatorRole: UserRole) {
    const access = await this.canUserMessageUser(initiatorId, targetUserId);
    if (!access.allowed) {
      throw new ForbiddenException(access.reason || 'Cannot message this user');
    }
    const initiatorConvs = await this.memRepo.find({ where: { userId: initiatorId } });
    const targetConvs = await this.memRepo.find({ where: { userId: targetUserId } });
    const initiatorConvIds = new Set(initiatorConvs.map((m) => m.conversationId));
    const sharedConvIds = targetConvs.filter((m) => initiatorConvIds.has(m.conversationId)).map((m) => m.conversationId);

    if (sharedConvIds.length > 0) {
      const existingDirects = await this.convRepo.find({ where: { id: In(sharedConvIds), type: 'direct' } });
      if (existingDirects.length > 0) {
        return { conversation: existingDirects[0], isNew: false };
      }
    }

    const userRepo = this.convRepo.manager.getRepository(User);
    const targetUser = await userRepo.findOne({ where: { id: targetUserId } });
    const initiatorUser = await userRepo.findOne({ where: { id: initiatorId } });
    const title = `${initiatorUser?.firstName ?? 'User'} & ${targetUser?.firstName ?? 'User'}`;

    const conversation = await this.createConversation(
      { type: 'direct', title, classOfferingId: null, parentVisible: true, createdById: initiatorId },
      [targetUserId],
    );
    return { conversation, isNew: true };
  }

  // ── Connection Management ──
  async requestConnection(requesterId: string, recipientId: string) {
    const connRepo = this.convRepo.manager.getRepository('ChatConnection');
    const existing = await connRepo.findOne({
      where: [
        { requesterId, recipientId },
        { requesterId: recipientId, recipientId: requesterId },
      ],
    });
    if (existing) throw new ForbiddenException('Connection already exists');

    const connection = connRepo.create({ requesterId, recipientId, status: 'pending' });
    return connRepo.save(connection);
  }

  async acceptConnection(connectionId: string, userId: string) {
    const connRepo = this.convRepo.manager.getRepository('ChatConnection');
    const conn = await connRepo.findOne({ where: { id: connectionId } });
    if (!conn || conn.recipientId !== userId) throw new ForbiddenException('Invalid connection');
    conn.status = 'accepted';
    return connRepo.save(conn);
  }

  async rejectConnection(connectionId: string, userId: string) {
    const connRepo = this.convRepo.manager.getRepository('ChatConnection');
    const conn = await connRepo.findOne({ where: { id: connectionId } });
    if (!conn || conn.recipientId !== userId) throw new ForbiddenException('Invalid connection');
    conn.status = 'rejected';
    return connRepo.save(conn);
  }

  async getConnections(userId: string) {
    const connRepo = this.convRepo.manager.getRepository('ChatConnection');
    const sent = await connRepo.find({ where: { requesterId: userId } });
    const received = await connRepo.find({ where: { recipientId: userId } });
    return { sent, received };
  }

  async areConnected(userId1: string, userId2: string): Promise<boolean> {
    const connRepo = this.convRepo.manager.getRepository('ChatConnection');
    const conn = await connRepo.findOne({
      where: [
        { requesterId: userId1, recipientId: userId2, status: 'accepted' },
        { requesterId: userId2, recipientId: userId1, status: 'accepted' },
      ],
    });
    return !!conn;
  }

  // ── Blocking ──
  async getBlockedUsers(userId: string) {
    return this.blockRepo.find({ where: { blockerId: userId } });
  }

  async isBlocked(userId1: string, userId2: string): Promise<boolean> {
    const block = await this.blockRepo.findOne({
      where: [
        { blockerId: userId1, blockedId: userId2 },
        { blockerId: userId2, blockedId: userId1 },
      ],
    });
    return !!block;
  }

  // ── Access Control ──
  async canUserMessageUser(fromUserId: string, toUserId: string): Promise<{ allowed: boolean; reason?: string }> {
    // Check if blocked
    if (await this.isBlocked(fromUserId, toUserId)) {
      return { allowed: false, reason: 'User is blocked' };
    }

    const userRepo = this.convRepo.manager.getRepository(User);
    const fromUser = await userRepo.findOne({ where: { id: fromUserId } });
    const toUser = await userRepo.findOne({ where: { id: toUserId } });

    if (!fromUser || !toUser) {
      return { allowed: false, reason: 'User not found' };
    }

    // Students can message teachers in their classes
    if (fromUser.role === UserRole.STUDENT && toUser.role === UserRole.TEACHER) {
      const enrollmentRepo = this.convRepo.manager.getRepository('Enrollment');
      const classOfferingRepo = this.convRepo.manager.getRepository('ClassOffering');
      
      // Get student's enrollments
      const enrollments = await enrollmentRepo.find({ where: { studentId: fromUserId } });
      const classIds = enrollments.map(e => e.classOfferingId);
      
      // Check if teacher teaches any of these classes
      const classes = await classOfferingRepo.find({ where: { id: In(classIds), teacherId: toUserId } });
      
      if (classes.length > 0) {
        return { allowed: true };
      }
      return { allowed: false, reason: 'Teacher does not teach your classes' };
    }

    // Students can message each other if connected
    if (fromUser.role === UserRole.STUDENT && toUser.role === UserRole.STUDENT) {
      if (await this.areConnected(fromUserId, toUserId)) {
        return { allowed: true };
      }
      return { allowed: false, reason: 'Connection required to message other students' };
    }

    // Teachers can message anyone
    if (fromUser.role === UserRole.TEACHER) {
      return { allowed: true };
    }

    // Parents can message teachers
    if (fromUser.role === UserRole.PARENT && toUser.role === UserRole.TEACHER) {
      return { allowed: true };
    }

    // Admin can message anyone
    if (fromUser.role === UserRole.ADMIN) {
      return { allowed: true };
    }

    return { allowed: false, reason: 'Not authorized to message this user' };
  }
}
