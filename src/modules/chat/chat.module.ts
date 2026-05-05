import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { MulterModule } from '@nestjs/platform-express';

import { Conversation } from './entities/conversation.entity';
import { ConversationMember } from './entities/conversation-member.entity';
import { ChatMessage } from './entities/chat-message.entity';
import { ConversationRead } from './entities/conversation-read.entity';
import { UserBlock } from './entities/user-block.entity';
import { ParentStudent } from '../parent-students/entities/parent-student.entity';
import { FileRecord } from '../files/entities/file-record.entity';

import { ChatService } from './chat.service';
import { ChatController } from './chat.controller';
import { ChatGateway } from './chat.gateway';
import { FilesModule } from '../files/files.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Conversation,
      ConversationMember,
      ChatMessage,
      ConversationRead,
      UserBlock,
      ParentStudent,
      FileRecord,
    ]),
    JwtModule.registerAsync({
      imports: [ConfigModule],
      useFactory: (config: ConfigService) => ({
        secret: config.get<string>('jwt.secret'),
        signOptions: { expiresIn: config.get<string>('jwt.accessExpires') },
      }),
      inject: [ConfigService],
    }),
    MulterModule.register({ limits: { fileSize: 50 * 1024 * 1024 } }),
    FilesModule,
  ],
  controllers: [ChatController],
  providers: [ChatService, ChatGateway],
  exports: [ChatService, ChatGateway],
})
export class ChatModule {}
