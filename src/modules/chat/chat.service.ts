import { ForbiddenException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { Conversation } from './entities/conversation.entity';
import { ConversationMember } from './entities/conversation-member.entity';
import { ChatMessage } from './entities/chat-message.entity';
import { ParentStudent } from '../parent-students/entities/parent-student.entity';
import { User, UserRole } from '../users/entities/user.entity';

@Injectable()
export class ChatService {
  constructor(
    @InjectRepository(Conversation) private readonly convRepo: Repository<Conversation>,
    @InjectRepository(ConversationMember) private readonly memRepo: Repository<ConversationMember>,
    @InjectRepository(ChatMessage) private readonly msgRepo: Repository<ChatMessage>,
    @InjectRepository(ParentStudent) private readonly psRepo: Repository<ParentStudent>,
  ) {}

  async assertMember(conversationId: string, userId: string) {
    const m = await this.memRepo.findOne({ where: { conversationId, userId } });
    if (!m) throw new ForbiddenException('Not a member');
  }

  /** Read: member, or parent with parentVisible + linked child is a member. */
  async assertReadAccess(conversationId: string, user: User) {
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
    return msg;
  }

  async listMessages(conversationId: string, user: User, limit = 50) {
    await this.assertReadAccess(conversationId, user);
    return this.msgRepo.find({
      where: { conversationId },
      order: { createdAt: 'DESC' },
      take: limit,
    });
  }
}
