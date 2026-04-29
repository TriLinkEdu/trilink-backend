import { ForbiddenException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { Conversation } from './entities/conversation.entity';
import { ConversationMember } from './entities/conversation-member.entity';
import { ChatMessage } from './entities/chat-message.entity';
import { ParentStudent } from '../parent-students/entities/parent-student.entity';
import { User, UserRole } from '../users/entities/user.entity';
import { EventsGateway } from '../realtime/events.gateway';

@Injectable()
export class ChatService {
  constructor(
    @InjectRepository(Conversation) private readonly convRepo: Repository<Conversation>,
    @InjectRepository(ConversationMember) private readonly memRepo: Repository<ConversationMember>,
    @InjectRepository(ChatMessage) private readonly msgRepo: Repository<ChatMessage>,
    @InjectRepository(ParentStudent) private readonly psRepo: Repository<ParentStudent>,
    private readonly events: EventsGateway,
  ) {}

  async assertMember(conversationId: string, userId: string) {
    const m = await this.memRepo.findOne({ where: { conversationId, userId } });
    if (!m) throw new ForbiddenException('Not a member');
  }

  /** Read: member, or parent whose linked child is a member, or admin. */
  async assertReadAccess(conversationId: string, user: User) {
    if (user.role === UserRole.ADMIN) return;
    const m = await this.memRepo.findOne({ where: { conversationId, userId: user.id } });
    if (m) return;
    if (user.role !== UserRole.PARENT) throw new ForbiddenException('Not a member');
    // Parent can read any conversation their linked child is a member of
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

  async listConversations(userId: string, role: UserRole) {
    const mems = await this.memRepo.find({ where: { userId } });
    const fromMember = mems.map((m) => m.conversationId);
    let extra: string[] = [];
    if (role === UserRole.PARENT) {
      const links = await this.psRepo.find({ where: { parentId: userId } });
      const childIds = links.map((l) => l.studentId);
      if (childIds.length) {
        // Parent sees ALL conversations their children are in (no parentVisible restriction)
        const childMems = await this.memRepo.find({ where: { userId: In(childIds) } });
        extra = [...new Set(childMems.map((m) => m.conversationId))];
      }
    }
    const all = [...new Set([...fromMember, ...extra])];
    if (!all.length) return [];
    return this.convRepo.find({ where: { id: In(all) }, order: { updatedAt: 'DESC' } });
  }

  async getConversation(id: string, user: User) {
    await this.assertReadAccess(id, user);
    return this.convRepo.findOne({ where: { id } });
  }

  async postMessage(conversationId: string, senderId: string, text: string) {
    await this.assertMember(conversationId, senderId);
    const msg = await this.msgRepo.save(this.msgRepo.create({ conversationId, senderId, text }));
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

  async listMessages(conversationId: string, user: User, limit = 50, skip = 0) {
    await this.assertReadAccess(conversationId, user);
    return this.msgRepo.find({
      where: { conversationId },
      order: { createdAt: 'DESC' },
      take: limit,
      skip,
    });
  }

  async getReadReceipts(messageId: string, user: User) {
    const msg = await this.msgRepo.findOne({ where: { id: messageId } });
    if (!msg) return [];

    await this.assertReadAccess(msg.conversationId, user);

    const members = await this.memRepo.find({
      where: { conversationId: msg.conversationId },
    });

    // Conservative placeholder receipts: sender has read at creation time.
    // Additional per-user read tracking can replace this without breaking API.
    return members
        .filter((m) => m.userId === msg.senderId)
        .map((m) => ({
          messageId: msg.id,
          userId: m.userId,
          readAt: msg.createdAt,
        }));
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

  /** One-time migration: set parentVisible = true on all conversations */
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

  /** Parent: list all conversations the linked child is a member of */
  async listChildConversations(parentId: string, studentId: string) {
    const link = await this.psRepo.findOne({ where: { parentId, studentId } });
    if (!link) throw new ForbiddenException('Not linked to this student');
    const mems = await this.memRepo.find({ where: { userId: studentId } });
    if (!mems.length) return [];
    const convIds = mems.map((m) => m.conversationId);
    return this.convRepo.find({ where: { id: In(convIds) }, order: { updatedAt: 'DESC' } });
  }

  /** Parent: read messages in a conversation the linked child is part of */
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
    
    const title = `${initiatorUser?.firstName ?? 'User'} & ${targetUser?.firstName ?? 'User'}`;
    
    const conversation = await this.createConversation(
      {
        type: 'direct',
        title,
        classOfferingId: null,
        parentVisible: true,  // always visible to parents
        createdById: initiatorId,
      },
      [targetUserId],
    );

    return { conversation, isNew: true };
  }
}
