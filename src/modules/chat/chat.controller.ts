import { BadRequestException, Body, Controller, Delete, Get, Param, ParseUUIDPipe, Patch, Post, Query, UploadedFile, UseGuards, UseInterceptors } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags, ApiQuery } from '@nestjs/swagger';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsArray, IsBoolean, IsOptional, IsString, IsUUID, MinLength } from 'class-validator';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole } from '../users/entities/user.entity';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { User } from '../users/entities/user.entity';
import { ChatService } from './chat.service';
import { InitiateChatDto } from './dto/initiate-chat.dto';
import { FilesService } from '../files/files.service';
import { ReactionDto } from './dto/reaction.dto';

class CreateConvDto {
  @ApiProperty({ example: 'group' }) @IsString() type: string;
  @ApiProperty() @IsString() @MinLength(1) title: string;
  @ApiPropertyOptional() @IsOptional() @IsUUID() classOfferingId?: string;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() parentVisible?: boolean;
  @ApiProperty({ type: [String] }) @IsArray() @IsUUID('4', { each: true }) memberIds: string[];
}

class MsgDto {
  @ApiPropertyOptional() @IsOptional() @IsString() @MinLength(1) text?: string;
  @ApiPropertyOptional() @IsOptional() @IsUUID() replyToId?: string;
  @ApiPropertyOptional() @IsOptional() @IsUUID() mediaFileId?: string;
}

class EditMsgDto {
  @ApiProperty() @IsString() @MinLength(1) text: string;
}

@ApiTags('Chat')
@Controller()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN, UserRole.TEACHER, UserRole.STUDENT, UserRole.PARENT)
@ApiBearerAuth('JWT')
export class ChatController {
  constructor(
    private readonly chat: ChatService,
    private readonly files: FilesService,
  ) {}

  @Get('chat/ws-info')
  @ApiOperation({ summary: 'WebSocket URL hint (use same origin / socket.io client)' })
  wsInfo() {
    return {
      protocol: 'socket.io',
      path: '/socket.io',
      note: 'Connect with JWT in auth handshake when enabled on client.',
    };
  }

  @Post('conversations')
  @ApiOperation({ summary: 'Create conversation and members' })
  create(@Body() dto: CreateConvDto, @CurrentUser() user: User) {
    return this.chat.createConversation(
      {
        type: dto.type,
        title: dto.title,
        classOfferingId: dto.classOfferingId ?? null,
        parentVisible: dto.parentVisible ?? false,
        createdById: user.id,
      },
      dto.memberIds,
    );
  }

  @Get('conversations')
  @ApiOperation({
    summary: 'List conversations',
    description:
      'Parents also see class threads where parentVisible is true and a linked child is a member (read-only until added as member).',
  })
  list(@CurrentUser() user: User) {
    return this.chat.listConversations(user.id, user.role);
  }

  @Get('conversations/all')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Admin: list all conversations (moderation)' })
  listAllForAdmin(@Query('take') take?: string, @Query('skip') skip?: string) {
    const t = Math.min(Math.max(parseInt(take ?? '', 10) || 50, 1), 200);
    const s = Math.max(parseInt(skip ?? '', 10) || 0, 0);
    return this.chat.listAllConversations(t, s);
  }

  @Get('conversations/:id')
  one(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: User) {
    return this.chat.getConversation(id, user);
  }

  @Get('conversations/:id/messages')
  messages(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: User,
    @Query('limit') limit?: string,
    @Query('skip') skip?: string,
  ) {
    return this.chat.listMessages(id, user, limit ? parseInt(limit, 10) : 50, skip ? parseInt(skip, 10) : 0);
  }

  @Post('conversations/:id/messages')
  post(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: MsgDto,
    @CurrentUser() user: User,
  ) {
    return this.chat.postMessage(id, user.id, dto.text, dto.mediaFileId ?? null, dto.replyToId ?? null);
  }

  @Patch('messages/:id')
  @ApiOperation({ summary: 'Edit own chat message text' })
  edit(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: EditMsgDto,
    @CurrentUser() user: User,
  ) {
    return this.chat.editMessage(id, user.id, dto.text);
  }

  @Delete('messages/:id')
  @ApiOperation({ summary: 'Soft-delete own chat message' })
  deleteMessage(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: User) {
    return this.chat.deleteMessage(id, user.id);
  }

  @Post('messages/:id/reactions')
  @ApiOperation({ summary: 'Toggle a reaction on a message' })
  react(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ReactionDto,
    @CurrentUser() user: User,
  ) {
    return this.chat.toggleReaction(id, user.id, dto.emoji);
  }

  @Post('conversations/:id/block')
  @ApiOperation({ summary: 'Block the other person in a direct conversation' })
  blockConversation(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: User) {
    return this.chat.blockConversationPeer(id, user.id);
  }

  @Delete('conversations/:id/block')
  @ApiOperation({ summary: 'Unblock the other person in a direct conversation' })
  unblockConversation(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: User) {
    return this.chat.unblockConversationPeer(id, user.id);
  }

  @Post('chat/files/upload')
  @ApiOperation({ summary: 'Upload a chat attachment' })
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      limits: { fileSize: 50 * 1024 * 1024 },
    }),
  )
  uploadChatFile(@UploadedFile() file: Express.Multer.File, @CurrentUser() user: User) {
    return this.files.uploadFile(file, user.id);
  }

  @Get('children/:childId/conversations')
  @Roles(UserRole.PARENT)
  @ApiOperation({ summary: 'List all conversations of a linked child' })
  getChildConversations(@Param('childId', ParseUUIDPipe) childId: string, @CurrentUser() user: User) {
    return this.chat.listChildConversations(childId, user.id);
  }

  @Get('children/:childId/conversations/:conversationId/messages')
  @Roles(UserRole.PARENT)
  @ApiOperation({ summary: 'List messages of a linked child conversation' })
  getChildMessages(
    @Param('childId', ParseUUIDPipe) childId: string,
    @Param('conversationId', ParseUUIDPipe) conversationId: string,
    @CurrentUser() user: User,
    @Query('limit') limit?: string,
    @Query('skip') skip?: string,
  ) {
    return this.chat.listChildMessages(childId, conversationId, user.id, limit ? parseInt(limit, 10) : 50, skip ? parseInt(skip, 10) : 0);
  }

  @Get('users/search')
  @ApiOperation({
    summary: 'Search users to initiate a chat',
    description: 'Searches relevant users by name. Teachers only see relevant subjects.',
  })
  @ApiQuery({ name: 'q', required: false, description: 'Search term for name/subject' })
  searchUsers(
    @Query('q') query: string,
    @CurrentUser() user: User,
  ) {
    return this.chat.searchUsers(user, query || '');
  }

  @Post('conversations/initiate')
  @ApiOperation({
    summary: 'Initiate a direct chat with another user',
    description: 'Creates a new direct conversation or returns existing one. Useful for parent-teacher or student-teacher chats.',
  })
  initiate(
    @Body() dto: InitiateChatDto,
    @CurrentUser() user: User,
  ) {
    return this.chat.initiateDirectChat(user.id, dto.targetUserId, user.role);
  }
}
