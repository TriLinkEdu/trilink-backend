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
    
    // Exclude current user
    qb.where('u.id != :currentUserId', { currentUserId: user.id });
    
    if (searchTerm) {
      qb.andWhere('(u.firstName ILIKE :term OR u.lastName ILIKE :term OR u.subject ILIKE :term)', { term: `%${searchTerm}%` });
    }
    
    // Grade-based filtering for students
    if (user.role === UserRole.STUDENT) {
      // Students can only see:
      // 1. Teachers (all)
      // 2. Students in the same grade
      qb.andWhere(
        '(u.role = :teacherRole OR (u.role = :studentRole AND u.grade = :userGrade))',
        { 
          teacherRole: UserRole.TEACHER,
          studentRole: UserRole.STUDENT,
          userGrade: user.grade 
        }
      );
    }
    
    // Teachers see everyone
    // Admin sees everyone
    // Parents see teachers and admins
    if (user.role === UserRole.PARENT) {
      qb.andWhere('u.role IN (:...allowedRoles)', { 
        allowedRoles: [UserRole.TEACHER, UserRole.ADMIN] 
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
      'u.childName'
    ]);
    
    qb.andWhere('u.id != :myId', { myId: user.id });
    qb.orderBy('u.role', 'ASC').addOrderBy('u.firstName', 'ASC');
    qb.take(20);
    
    return qb.getMany();
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
    // Validate access
    const access = await this.canUserMessageUser(initiatorId, targetUserId);
    if (!access.allowed) {
      throw new ForbiddenException(access.reason || 'Cannot message this user');
    }

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
        parentVisible: initiatorRole === UserRole.PARENT || initiatorRole === UserRole.STUDENT,
        createdById: initiatorId,
      },
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
  async blockUser(blockerId: string, blockedId: string) {
    const blockRepo = this.convRepo.manager.getRepository('BlockedUser');
    const existing = await blockRepo.findOne({ where: { blockerId, blockedId } });
    if (existing) return existing;
    const block = blockRepo.create({ blockerId, blockedId });
    return blockRepo.save(block);
  }

  async unblockUser(blockerId: string, blockedId: string) {
    const blockRepo = this.convRepo.manager.getRepository('BlockedUser');
    await blockRepo.delete({ blockerId, blockedId });
    return { ok: true };
  }

  async getBlockedUsers(userId: string) {
    const blockRepo = this.convRepo.manager.getRepository('BlockedUser');
    return blockRepo.find({ where: { blockerId: userId } });
  }

  async isBlocked(userId1: string, userId2: string): Promise<boolean> {
    const blockRepo = this.convRepo.manager.getRepository('BlockedUser');
    const block = await blockRepo.findOne({
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
