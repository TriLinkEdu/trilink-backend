import { ForbiddenException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { Conversation } from './entities/conversation.entity';
import { ConversationMember } from './entities/conversation-member.entity';
import { ChatMessage } from './entities/chat-message.entity';
import { ConversationRead } from './entities/conversation-read.entity';
import { ParentStudent } from '../parent-students/entities/parent-student.entity';
import { UserBlock } from './entities/user-block.entity';
import { FileRecord } from '../files/entities/file-record.entity';
import { User, UserRole } from '../users/entities/user.entity';
import { EventsGateway } from '../realtime/events.gateway';

@Injectable()
export class ChatService {
  private readonly onlineUserIds = new Set<string>();

  constructor(
    @InjectRepository(Conversation) private readonly convRepo: Repository<Conversation>,
    @InjectRepository(ConversationMember) private readonly memRepo: Repository<ConversationMember>,
    @InjectRepository(ChatMessage) private readonly msgRepo: Repository<ChatMessage>,
    @InjectRepository(ConversationRead) private readonly readRepo: Repository<ConversationRead>,
    @InjectRepository(ParentStudent) private readonly psRepo: Repository<ParentStudent>,
    @InjectRepository(UserBlock) private readonly blockRepo: Repository<UserBlock>,
    @InjectRepository(FileRecord) private readonly fileRepo: Repository<FileRecord>,
    private readonly events: EventsGateway,
  ) {}

  async assertMember(conversationId: string, userId: string) {
    const m = await this.memRepo.findOne({ where: { conversationId, userId } });
    if (!m) throw new ForbiddenException('Not a member');
  }

  /** Read: member, or parent with parentVisible + linked child is a member, or admin. */
  async assertReadAccess(conversationId: string, user: User) {
    if (user.role === UserRole.ADMIN) return;
    const m = await this.memRepo.findOne({ where: { conversationId, userId: user.id } });
    if (m) return;
    if (user.role !== UserRole.PARENT) throw new ForbiddenException('Not a member');
    const conv = await this.convRepo.findOne({ where: { id: conversationId } });
    if (!conv?.parentVisible) throw new ForbiddenException('Not a member');
    const members = await this.memRepo.find({ where: { conversationId } });
    const linkedChildIds = (await this.psRepo.find({ where: { parentId: user.id } })).map((l) => l.studentId);
    const ok = members.some((mem) => linkedChildIds.includes(mem.userId));
    if (!ok) throw new ForbiddenException('Not a member');
  }

  async createConversation(
    body: Pick<Conversation, 'type' | 'title' | 'classOfferingId' | 'parentVisible' | 'createdById'>,
    memberIds: string[],
  ) {
    const c = await this.convRepo.save(this.convRepo.create(body));
    const uniq = [...new Set([body.createdById, ...memberIds])];
    for (const uid of uniq) {
      await this.memRepo.save(this.memRepo.create({ conversationId: c.id, userId: uid }));
    }
    return this.convRepo.findOne({ where: { id: c.id } });
  }

  async getUserConversationIds(userId: string): Promise<string[]> {
    const mems = await this.memRepo.find({ where: { userId } });
    return [...new Set(mems.map((m) => m.conversationId))];
  }

  private async getDirectPeerUserId(conversationId: string, userId: string): Promise<string | null> {
    const conversation = await this.convRepo.findOne({ where: { id: conversationId } });
    if (!conversation || conversation.type !== 'direct') return null;

    const members = await this.memRepo.find({ where: { conversationId } });
    const peer = members.find((member) => member.userId !== userId);
    return peer?.userId ?? null;
  }

  private async getBlockState(conversationId: string, userId: string) {
    const peerUserId = await this.getDirectPeerUserId(conversationId, userId);
    if (!peerUserId) {
      return { blockedByMe: false, blockedMe: false, peerUserId: null };
    }

    const blockedByMe = await this.blockRepo.exist({ where: { blockerId: userId, blockedId: peerUserId } });
    const blockedMe = await this.blockRepo.exist({ where: { blockerId: peerUserId, blockedId: userId } });
    return { blockedByMe, blockedMe, peerUserId };
  }

  async blockConversationPeer(conversationId: string, userId: string) {
    const { peerUserId } = await this.getBlockState(conversationId, userId);
    if (!peerUserId) throw new ForbiddenException('Only direct conversations can be blocked');

    await this.blockRepo.upsert(
      this.blockRepo.create({ blockerId: userId, blockedId: peerUserId }),
      ['blockerId', 'blockedId'],
    );
    return { blockedByMe: true, blockedMe: false, peerUserId };
  }

  async unblockConversationPeer(conversationId: string, userId: string) {
    const { peerUserId } = await this.getBlockState(conversationId, userId);
    if (!peerUserId) throw new ForbiddenException('Only direct conversations can be unblocked');

    await this.blockRepo.delete({ blockerId: userId, blockedId: peerUserId });
    return { blockedByMe: false, blockedMe: false, peerUserId };
  }

  async setOnline(_userId: string, _isOnline: boolean): Promise<void> {
    if (_isOnline) {
      this.onlineUserIds.add(_userId);
      return;
    }
    this.onlineUserIds.delete(_userId);
  }

  isUserOnline(userId: string): boolean {
    return this.onlineUserIds.has(userId);
  }

  async upsertReadRecord(userId: string, conversationId: string, messageId: string): Promise<void> {
    await this.readRepo.save(
      this.readRepo.create({
        userId,
        conversationId,
        lastReadMessageId: messageId,
      }),
    );
  }

  async listConversations(userId: string, role: UserRole) {
    const mems = await this.memRepo.find({ where: { userId } });
    const fromMember = mems.map((m) => m.conversationId);
    let extra: string[] = [];
    if (role === UserRole.PARENT) {
      const links = await this.psRepo.find({ where: { parentId: userId } });
      const childIds = links.map((l) => l.studentId);
      if (childIds.length) {
        const childMems = await this.memRepo.find({ where: { userId: In(childIds) } });
        const convIds = [...new Set(childMems.map((m) => m.conversationId))];
        if (convIds.length) {
          const convs = await this.convRepo.find({
            where: { id: In(convIds), parentVisible: true },
          });
          extra = convs.map((c) => c.id);
        }
      }
    }
    const all = [...new Set([...fromMember, ...extra])];
    if (!all.length) return [];

    const conversations = await this.convRepo.find({ where: { id: In(all) }, order: { updatedAt: 'DESC' } });
    if (!conversations.length) return [];

    const conversationIds = conversations.map((c) => c.id);
    const members = await this.memRepo.find({ where: { conversationId: In(conversationIds) } });
    const uniqueUserIds = [...new Set(members.map((m) => m.userId))];
    const users = uniqueUserIds.length
      ? await this.convRepo.manager.getRepository(User).find({ where: { id: In(uniqueUserIds) } })
      : [];
    const directConversationIds = conversations.filter((conversation) => conversation.type === 'direct').map((conversation) => conversation.id);
    const blockPairs = directConversationIds.length
      ? await this.blockRepo
          .createQueryBuilder('block')
          .where('block.blockerId = :userId', { userId })
          .andWhere(
            `block.blockedId IN (
              SELECT mem.user_id
              FROM conversation_members mem
              WHERE mem.conversation_id IN (:...conversationIds)
                AND mem.user_id <> :userId
            )`,
            { conversationIds: directConversationIds },
          )
          .getMany()
      : [];
    const blockedPeerIds = new Set(blockPairs.map((block) => block.blockedId));
    const blockedByMePairs = directConversationIds.length
      ? await this.blockRepo
          .createQueryBuilder('block')
          .where('block.blockedId = :userId', { userId })
          .andWhere(
            `block.blockerId IN (
              SELECT mem.user_id
              FROM conversation_members mem
              WHERE mem.conversation_id IN (:...conversationIds)
                AND mem.user_id <> :userId
            )`,
            { conversationIds: directConversationIds },
          )
          .getMany()
      : [];
    const blockedMePeerIds = new Set(blockedByMePairs.map((block) => block.blockerId));

    // Fetch the last message for each conversation
    const lastMessages = await Promise.all(
      conversationIds.map((convId) =>
        this.msgRepo.findOne({
          where: { conversationId: convId },
          order: { createdAt: 'DESC' },
        }),
      ),
    );

    const messagesByConversationId = new Map<string, ChatMessage>();
    for (const msg of lastMessages) {
      if (msg) messagesByConversationId.set(msg.conversationId, msg);
    }

    const userById = new Map(users.map((u) => [u.id, u]));
    const membersByConversationId = new Map<string, typeof members>();

    for (const member of members) {
      const list = membersByConversationId.get(member.conversationId) ?? [];
      list.push(member);
      membersByConversationId.set(member.conversationId, list);
    }

    return conversations.map((conversation) => {
      const conversationMembers = membersByConversationId.get(conversation.id) ?? [];
      const resolvedMembers = conversationMembers.map((member) => {
        const resolvedUser = userById.get(member.userId);
        const firstName = resolvedUser?.firstName?.trim() ?? '';
        const lastName = resolvedUser?.lastName?.trim() ?? '';
        const displayName = `${firstName} ${lastName}`.trim() || `User ${member.userId.slice(0, 6)}`;
        return {
          userId: member.userId,
          role: resolvedUser?.role ?? null,
          displayName,
          isOnline: this.isUserOnline(member.userId),
        };
      });

      const lastMessage = messagesByConversationId.get(conversation.id);
      const peerUserId = conversation.type === 'direct'
        ? conversationMembers.find((member) => member.userId !== userId)?.userId ?? null
        : null;

      return {
        ...conversation,
        memberIds: conversationMembers.map((m) => m.userId),
        members: resolvedMembers,
        lastMessageText: lastMessage?.text || lastMessage?.mediaName || null,
        lastMessageAt: lastMessage?.createdAt || conversation.updatedAt,
        lastMessageSenderId: lastMessage?.senderId || null,
        blockedByMe: peerUserId ? blockedPeerIds.has(peerUserId) : false,
        blockedMe: peerUserId ? blockedMePeerIds.has(peerUserId) : false,
      };
    });
  }

  async getConversation(id: string, user: User) {
    await this.assertReadAccess(id, user);
    return this.convRepo.findOne({ where: { id } });
  }

  async postMessage(conversationId: string, senderId: string, text?: string | null, mediaFileId?: string | null, replyToId?: string | null) {
    await this.assertMember(conversationId, senderId);
    const blockState = await this.getBlockState(conversationId, senderId);
    if (blockState.blockedByMe || blockState.blockedMe) {
      throw new ForbiddenException('This conversation is blocked');
    }

    const mediaFile = mediaFileId ? await this.fileRepo.findOne({ where: { id: mediaFileId } }) : null;
    if (!text?.trim() && !mediaFile) {
      throw new ForbiddenException('Message text or media file is required');
    }

    const mediaType = mediaFile
      ? mediaFile.mime.startsWith('image/')
        ? 'image'
        : mediaFile.mime.startsWith('video/')
          ? 'video'
          : mediaFile.mime.startsWith('audio/')
            ? 'audio'
            : 'file'
      : null;

    const msg = await this.msgRepo.save(
      this.msgRepo.create({
        conversationId,
        senderId,
        text: text?.trim() || null,
        replyToId: replyToId ?? null,
        mediaFileId: mediaFile?.id ?? null,
        mediaType,
        mediaName: mediaFile?.filename ?? null,
        mediaMimeType: mediaFile?.mime ?? null,
        mediaSize: mediaFile?.sizeBytes ? Number(mediaFile.sizeBytes) : null,
        imageUrl: mediaFile?.mime.startsWith('image/') ? mediaFile.path : undefined,
      }),
    );
    const conv = await this.convRepo.findOne({ where: { id: conversationId } });
    if (conv) await this.convRepo.save(conv);

    // Emit real-time event
    const members = await this.memRepo.find({ where: { conversationId } });
    for (const mem of members) {
      if (mem.userId !== senderId) {
        this.events.emitToUser(mem.userId, 'message:new', {
          conversationId,
          message: msg,
        });
      }
    }

    return msg;
  }

  async editMessage(messageId: string, userId: string, text: string) {
    const msg = await this.msgRepo.findOne({ where: { id: messageId } });
    if (!msg) throw new ForbiddenException('Message not found');
    if (msg.senderId !== userId) throw new ForbiddenException('You can only edit your own messages');
    if (msg.deletedAt) throw new ForbiddenException('Message is deleted');
    const trimmed = text?.trim();
    if (!trimmed) throw new ForbiddenException('Message text is required');
    msg.text = trimmed;
    msg.editedAt = new Date();
    await this.msgRepo.save(msg);
    const members = await this.memRepo.find({ where: { conversationId: msg.conversationId } });
    for (const mem of members) {
      if (mem.userId !== userId) {
        this.events.emitToUser(mem.userId, 'message:update', { conversationId: msg.conversationId, message: msg });
      }
    }
    return msg;
  }

  async deleteMessage(messageId: string, userId: string) {
    const msg = await this.msgRepo.findOne({ where: { id: messageId } });
    if (!msg) throw new ForbiddenException('Message not found');
    if (msg.senderId !== userId) throw new ForbiddenException('You can only delete your own messages');
    msg.deletedAt = new Date();
    await this.msgRepo.save(msg);
    const members = await this.memRepo.find({ where: { conversationId: msg.conversationId } });
    for (const mem of members) {
      if (mem.userId !== userId) {
        this.events.emitToUser(mem.userId, 'message:delete', { conversationId: msg.conversationId, messageId });
      }
    }
    return { ok: true };
  }

  async toggleReaction(messageId: string, userId: string, emoji: string) {
    const msg = await this.msgRepo.findOne({ where: { id: messageId } });
    if (!msg) throw new ForbiddenException('Message not found');

    await this.assertMember(msg.conversationId, userId);
    const reactions = { ...(msg.reactions ?? {}) } as Record<string, string[]>;
    const users = new Set(reactions[emoji] ?? []);
    if (users.has(userId)) {
      users.delete(userId);
    } else {
      users.add(userId);
    }

    if (users.size === 0) {
      delete reactions[emoji];
    } else {
      reactions[emoji] = [...users];
    }

    msg.reactions = reactions;
    await this.msgRepo.save(msg);
    return msg;
  }

  async listMessages(conversationId: string, user: User, limit = 50, skip = 0) {
    await this.assertReadAccess(conversationId, user);
    return this.msgRepo.find({
      where: { conversationId },
      order: { createdAt: 'DESC' },
      take: limit,
      skip,
    });
  }

  async assertChildAccess(childId: string, parentId: string) {
    const link = await this.psRepo.findOne({ where: { parentId, studentId: childId } });
    if (!link) throw new ForbiddenException('Not your child');
  }

  async listChildConversations(childId: string, parentId: string) {
    await this.assertChildAccess(childId, parentId);
    const mems = await this.memRepo.find({ where: { userId: childId } });
    const convIds = [...new Set(mems.map((m) => m.conversationId))];
    if (!convIds.length) return [];
    return this.convRepo.find({ where: { id: In(convIds) }, order: { updatedAt: 'DESC' } });
  }

  async listChildMessages(childId: string, conversationId: string, parentId: string, limit = 50, skip = 0) {
    await this.assertChildAccess(childId, parentId);
    const m = await this.memRepo.findOne({ where: { conversationId, userId: childId } });
    if (!m) throw new ForbiddenException('Child is not a member of this conversation');
    return this.msgRepo.find({
      where: { conversationId },
      order: { createdAt: 'DESC' },
      take: limit,
      skip,
    });
  }

  async searchUsers(user: User, searchTerm: string) {
    const userRepo = this.convRepo.manager.getRepository(User);
    const qb = userRepo.createQueryBuilder('u');
    
    if (searchTerm) {
      qb.where('(u.firstName ILIKE :term OR u.lastName ILIKE :term OR u.subject ILIKE :term)', { term: `%${searchTerm}%` });
    }
    
    // Admin sees everyone, others see admins + potentially related users 
    // (For simplicity, we constrain non-admins to search admins/teachers unless we need deeper relationship graphs)
    // We can allow all roles to be searched if queried, but limit the returned payload severely.
    // The prompt says "no need to fetch all users", we limit by take(20).
    
    qb.select([
      'u.id',
      'u.firstName',
      'u.lastName',
      'u.role',
      'u.subject',
      'u.grade',
      'u.section',
      'u.profileImageFileId',
      'u.childName'
    ]);
    
    qb.andWhere('u.id != :myId', { myId: user.id });
    qb.take(20);
    
    return qb.getMany();
  }

  async listAllConversations(take = 50, skip = 0) {
    return this.convRepo.find({ order: { updatedAt: 'DESC' }, take, skip });
  }

  /** Initiate a direct conversation between two users */
  async initiateDirectChat(initiatorId: string, targetUserId: string, initiatorRole: UserRole) {
    // Check if conversation already exists between these two users
    const initiatorConvs = await this.memRepo.find({ where: { userId: initiatorId } });
    const targetConvs = await this.memRepo.find({ where: { userId: targetUserId } });
    
    const initiatorConvIds = new Set(initiatorConvs.map((m) => m.conversationId));
    const sharedConvIds = targetConvs
      .filter((m) => initiatorConvIds.has(m.conversationId))
      .map((m) => m.conversationId);

    if (sharedConvIds.length > 0) {
      // Check if any of these are direct conversations
      const existingDirects = await this.convRepo.find({
        where: { id: In(sharedConvIds), type: 'direct' },
      });
      
      if (existingDirects.length > 0) {
        // Return the first existing direct conversation
        return { conversation: existingDirects[0], isNew: false };
      }
    }

    // Create new direct conversation
    const userRepo = this.convRepo.manager.getRepository(User);
    const targetUser = await userRepo.findOne({ where: { id: targetUserId } });
    const initiatorUser = await userRepo.findOne({ where: { id: initiatorId } });
    
    const initiatorName = `${initiatorUser?.firstName ?? ''} ${initiatorUser?.lastName ?? ''}`.trim() || 'User';
    const targetName = `${targetUser?.firstName ?? ''} ${targetUser?.lastName ?? ''}`.trim() || 'User';
    const title = `${initiatorName} & ${targetName}`;
    
    const conversation = await this.createConversation(
      {
        type: 'direct',
        title,
        classOfferingId: null,
        parentVisible: initiatorRole === UserRole.PARENT || initiatorRole === UserRole.STUDENT,
        createdById: initiatorId,
      },
      [targetUserId],
    );

    return { conversation, isNew: true };
  }
}
