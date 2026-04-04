import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Conversation } from './entities/conversation.entity';
import { ConversationMember } from './entities/conversation-member.entity';
import { ChatMessage } from './entities/chat-message.entity';
import { ParentStudent } from '../parent-students/entities/parent-student.entity';
import { ChatService } from './chat.service';
import { ChatController } from './chat.controller';

@Module({
  imports: [TypeOrmModule.forFeature([Conversation, ConversationMember, ChatMessage, ParentStudent])],
  controllers: [ChatController],
  providers: [ChatService],
  exports: [ChatService],
})
export class ChatModule {}
