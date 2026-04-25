import { BadRequestException, Body, Controller, Get, Param, ParseUUIDPipe, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiParam, ApiQuery, ApiResponse, ApiTags } from '@nestjs/swagger';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsArray, IsBoolean, IsOptional, IsString, IsUUID, MinLength } from 'class-validator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole } from '../users/entities/user.entity';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { User } from '../users/entities/user.entity';
import { ChatService } from './chat.service';
import { InitiateChatDto } from './dto/initiate-chat.dto';

class CreateConvDto {
  @ApiProperty({ example: 'group' }) @IsString() type: string;
  @ApiProperty() @IsString() @MinLength(1) title: string;
  @ApiPropertyOptional() @IsOptional() @IsUUID() classOfferingId?: string;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() parentVisible?: boolean;
  @ApiProperty({ type: [String] }) @IsArray() @IsUUID('4', { each: true }) memberIds: string[];
}

class MsgDto {
  @ApiProperty() @IsString() @MinLength(1) text: string;
}

@ApiTags('Chat')
@Controller()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN, UserRole.TEACHER, UserRole.STUDENT, UserRole.PARENT)
@ApiBearerAuth('JWT')
export class ChatController {
  constructor(private readonly chat: ChatService) {}

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
  @ApiOperation({ summary: 'List messages in a conversation (paginated)', description: 'Member, or parent with parentVisible + linked child is member.' })
  @ApiParam({ name: 'id', description: 'Conversation UUID' })
  @ApiQuery({ name: 'limit', required: false, example: '50' })
  @ApiQuery({ name: 'skip', required: false, example: '0' })
  messages(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: User,
    @Query('limit') limit?: string,
    @Query('skip') skip?: string,
  ) {
    return this.chat.listMessages(id, user, limit ? parseInt(limit, 10) : 50, skip ? parseInt(skip, 10) : 0);
  }

  // ── Parent: view child's chat history ─────────────────────────────────────

  @Get('chat/children/:studentId/conversations')
  @Roles(UserRole.PARENT)
  @ApiOperation({
    summary: "Parent: list child's conversations",
    description: 'Returns all conversations the linked child is a member of. Parent must be linked to the student.',
  })
  @ApiParam({ name: 'studentId', description: 'Student UUID' })
  @ApiResponse({
    status: 200,
    description: "Child's conversation list",
    schema: { example: [{ id: 'uuid', title: 'Biology Class Chat', type: 'group', parentVisible: true, updatedAt: '2026-04-22T10:00:00.000Z' }] },
  })
  @ApiResponse({ status: 403, description: 'Not linked to this student' })
  childConversations(
    @Param('studentId', ParseUUIDPipe) studentId: string,
    @CurrentUser() user: User,
  ) {
    return this.chat.listChildConversations(user.id, studentId);
  }

  @Get('chat/children/:studentId/conversations/:convId/messages')
  @Roles(UserRole.PARENT)
  @ApiOperation({
    summary: "Parent: read messages in child's conversation",
    description: 'Returns messages from a specific conversation the child is in. Parent must be linked to the student.',
  })
  @ApiParam({ name: 'studentId', description: 'Student UUID' })
  @ApiParam({ name: 'convId', description: 'Conversation UUID' })
  @ApiQuery({ name: 'limit', required: false, example: '50' })
  @ApiQuery({ name: 'skip', required: false, example: '0' })
  @ApiResponse({
    status: 200,
    schema: { example: { conversationId: 'uuid', messages: [{ id: 'uuid', senderId: 'uuid', text: 'Hello', createdAt: '2026-04-22T10:00:00.000Z' }] } },
  })
  childConversationMessages(
    @Param('studentId', ParseUUIDPipe) studentId: string,
    @Param('convId', ParseUUIDPipe) convId: string,
    @CurrentUser() user: User,
    @Query('limit') limit?: string,
    @Query('skip') skip?: string,
  ) {
    return this.chat.listChildConversationMessages(user.id, studentId, convId, limit ? parseInt(limit, 10) : 50, skip ? parseInt(skip, 10) : 0);
  }

  @Post('conversations/:id/messages')
  post(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: MsgDto,
    @CurrentUser() user: User,
  ) {
    return this.chat.postMessage(id, user.id, dto.text);
  }

  @Get('messages/:id/read-receipts')
  @ApiOperation({
    summary: 'Get read receipts for a message',
    description:
      'Currently returns conservative receipts based on existing message metadata.',
  })
  readReceipts(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: User,
  ) {
    return this.chat.getReadReceipts(id, user);
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
