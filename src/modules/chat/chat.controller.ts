import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiBearerAuth,
  ApiConsumes,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';
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
import { SendMessageDto } from './dto/send-message.dto';
import { EditMessageDto } from './dto/edit-message.dto';
import { ReactionDto } from './dto/reaction.dto';
import { AddMembersDto } from './dto/add-members.dto';
import { UpdateConversationDto } from './dto/update-conversation.dto';

class CreateConvDto {
  @ApiProperty({ example: 'group' }) @IsString() type: string;
  @ApiProperty() @IsString() @MinLength(1) title: string;
  @ApiPropertyOptional() @IsOptional() @IsString() description?: string;
  @ApiPropertyOptional() @IsOptional() @IsUUID() classOfferingId?: string;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() parentVisible?: boolean;
  @ApiProperty({ type: [String] }) @IsArray() @IsUUID('4', { each: true }) memberIds: string[];
}

@ApiTags('Chat')
@Controller()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN, UserRole.TEACHER, UserRole.STUDENT, UserRole.PARENT)
@ApiBearerAuth('JWT')
export class ChatController {
  constructor(private readonly chat: ChatService) {}

  // ── Admin helpers ──────────────────────────────────────────────────────────

  @Post('admin/fix-parent-visibility')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Admin: set parentVisible = true on all existing conversations' })
  fixParentVisibility() {
    return this.chat.setAllParentVisible();
  }

  // ── Conversations ──────────────────────────────────────────────────────────

  @Post('conversations')
  @ApiOperation({ summary: 'Create a conversation' })
  create(@Body() dto: CreateConvDto, @CurrentUser() user: User) {
    return this.chat.createConversation(
      {
        type: dto.type,
        title: dto.title,
        description: dto.description,
        classOfferingId: dto.classOfferingId ?? null,
        parentVisible: dto.parentVisible ?? true,
        createdById: user.id,
      },
      dto.memberIds,
    );
  }

  @Post('conversations/initiate')
  @ApiOperation({ summary: 'Initiate or retrieve a direct conversation' })
  initiate(@Body() dto: InitiateChatDto, @CurrentUser() user: User) {
    return this.chat.initiateDirectChat(user.id, dto.targetUserId, user.role);
  }

  @Get('conversations')
  @ApiOperation({ summary: 'List conversations (enriched)' })
  list(@CurrentUser() user: User) {
    return this.chat.listConversations(user.id, user.role);
  }

  @Get('conversations/all')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Admin: list all conversations' })
  listAll(@Query('take') take?: string, @Query('skip') skip?: string) {
    return this.chat.listAllConversations(
      Math.min(Math.max(parseInt(take ?? '', 10) || 50, 1), 200),
      Math.max(parseInt(skip ?? '', 10) || 0, 0),
    );
  }

  @Get('conversations/:id')
  @ApiParam({ name: 'id', description: 'Conversation UUID' })
  getOne(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: User) {
    return this.chat.getConversation(id, user);
  }

  @Patch('conversations/:id')
  @ApiOperation({ summary: 'Update conversation title/description/avatar (admin only)' })
  @ApiParam({ name: 'id', description: 'Conversation UUID' })
  updateConversation(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateConversationDto,
    @CurrentUser() user: User,
  ) {
    return this.chat.updateConversation(id, user.id, dto);
  }

  // ── Messages ───────────────────────────────────────────────────────────────

  @Get('conversations/:id/messages')
  @ApiOperation({ summary: 'List messages (cursor-paginated)' })
  @ApiParam({ name: 'id', description: 'Conversation UUID' })
  @ApiQuery({ name: 'before', required: false, description: 'Cursor message UUID' })
  @ApiQuery({ name: 'limit', required: false, example: '50' })
  listMessages(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: User,
    @Query('before') before?: string,
    @Query('limit') limit?: string,
  ) {
    return this.chat.listMessages(id, user, limit ? parseInt(limit, 10) : 50, before);
  }

  @Post('conversations/:id/messages')
  @ApiOperation({ summary: 'Send a message' })
  @ApiParam({ name: 'id', description: 'Conversation UUID' })
  sendMessage(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: SendMessageDto,
    @CurrentUser() user: User,
  ) {
    return this.chat.sendMessage(id, user.id, dto);
  }

  @Patch('conversations/:id/messages/:msgId')
  @ApiOperation({ summary: 'Edit a message (sender only)' })
  @ApiParam({ name: 'id', description: 'Conversation UUID' })
  @ApiParam({ name: 'msgId', description: 'Message UUID' })
  editMessage(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('msgId', ParseUUIDPipe) msgId: string,
    @Body() dto: EditMessageDto,
    @CurrentUser() user: User,
  ) {
    return this.chat.editMessage(id, msgId, user.id, dto.text);
  }

  @Delete('conversations/:id/messages/:msgId')
  @ApiOperation({ summary: 'Soft-delete a message (sender or admin)' })
  @ApiParam({ name: 'id', description: 'Conversation UUID' })
  @ApiParam({ name: 'msgId', description: 'Message UUID' })
  deleteMessage(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('msgId', ParseUUIDPipe) msgId: string,
    @CurrentUser() user: User,
  ) {
    return this.chat.deleteMessage(id, msgId, user.id, user.role);
  }

  @Post('conversations/:id/messages/:msgId/reactions')
  @ApiOperation({ summary: 'Toggle emoji reaction on a message' })
  @ApiParam({ name: 'id', description: 'Conversation UUID' })
  @ApiParam({ name: 'msgId', description: 'Message UUID' })
  toggleReaction(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('msgId', ParseUUIDPipe) msgId: string,
    @Body() dto: ReactionDto,
    @CurrentUser() user: User,
  ) {
    return this.chat.toggleReaction(id, msgId, user.id, dto.emoji);
  }

  @Post('conversations/:id/messages/:msgId/read')
  @ApiOperation({ summary: 'Mark a message as read' })
  @ApiParam({ name: 'id', description: 'Conversation UUID' })
  @ApiParam({ name: 'msgId', description: 'Message UUID' })
  async markRead(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('msgId', ParseUUIDPipe) msgId: string,
    @CurrentUser() user: User,
  ) {
    await this.chat.markRead(id, user.id, msgId);
    return { ok: true };
  }

  // ── Members ────────────────────────────────────────────────────────────────

  @Get('conversations/:id/members')
  @ApiOperation({ summary: 'List conversation members' })
  @ApiParam({ name: 'id', description: 'Conversation UUID' })
  listMembers(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: User) {
    return this.chat.listMembers(id, user.id);
  }

  @Post('conversations/:id/members')
  @ApiOperation({ summary: 'Add members to conversation (admin only)' })
  @ApiParam({ name: 'id', description: 'Conversation UUID' })
  async addMembers(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: AddMembersDto,
    @CurrentUser() user: User,
  ) {
    await this.chat.addMembers(id, user.id, dto.userIds);
    return { ok: true };
  }

  @Delete('conversations/:id/members/:userId')
  @ApiOperation({ summary: 'Remove a member (admin or self)' })
  @ApiParam({ name: 'id', description: 'Conversation UUID' })
  @ApiParam({ name: 'userId', description: 'User UUID to remove' })
  async removeMember(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('userId', ParseUUIDPipe) targetUserId: string,
    @CurrentUser() user: User,
  ) {
    await this.chat.removeMember(id, user.id, targetUserId);
    return { ok: true };
  }

  // ── Media gallery ──────────────────────────────────────────────────────────

  @Get('conversations/:id/media')
  @ApiOperation({ summary: 'Get media gallery grouped by type' })
  @ApiParam({ name: 'id', description: 'Conversation UUID' })
  getMedia(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: User) {
    return this.chat.getMediaGallery(id, user.id);
  }

  // ── Block system ───────────────────────────────────────────────────────────

  @Post('users/:userId/block')
  @ApiOperation({ summary: 'Block a user' })
  @ApiParam({ name: 'userId', description: 'User UUID to block' })
  async blockUser(
    @Param('userId', ParseUUIDPipe) targetId: string,
    @CurrentUser() user: User,
  ) {
    await this.chat.blockUser(user.id, targetId);
    return { ok: true };
  }

  @Delete('users/:userId/block')
  @ApiOperation({ summary: 'Unblock a user' })
  @ApiParam({ name: 'userId', description: 'User UUID to unblock' })
  async unblockUser(
    @Param('userId', ParseUUIDPipe) targetId: string,
    @CurrentUser() user: User,
  ) {
    await this.chat.unblockUser(user.id, targetId);
    return { ok: true };
  }

  @Get('users/blocked')
  @ApiOperation({ summary: 'List blocked users' })
  listBlocked(@CurrentUser() user: User) {
    return this.chat.listBlocked(user.id);
  }

  // ── Presence ───────────────────────────────────────────────────────────────

  @Get('users/presence')
  @ApiOperation({ summary: 'Get online presence for a list of users' })
  @ApiQuery({ name: 'userIds', description: 'Comma-separated user UUIDs (max 100)' })
  getPresence(@Query('userIds') userIds: string) {
    if (!userIds) throw new BadRequestException('userIds query param required');
    const ids = userIds.split(',').map((s) => s.trim()).filter(Boolean);
    return this.chat.getPresence(ids);
  }

  // ── Media upload ───────────────────────────────────────────────────────────

  @Post('chat/upload')
  @ApiOperation({ summary: 'Upload chat media (max 50 MB)' })
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(FileInterceptor('file'))
  uploadMedia(
    @UploadedFile() file: Express.Multer.File,
    @CurrentUser() user: User,
  ) {
    return this.chat.uploadChatMedia(file, user.id);
  }

  // ── Legacy / parent endpoints ──────────────────────────────────────────────

  @Get('chat/children/:studentId/conversations')
  @Roles(UserRole.PARENT)
  @ApiOperation({ summary: "Parent: list child's conversations" })
  childConversations(
    @Param('studentId', ParseUUIDPipe) studentId: string,
    @CurrentUser() user: User,
  ) {
    return this.chat.listChildConversations(user.id, studentId);
  }

  @Get('chat/children/:studentId/conversations/:convId/messages')
  @Roles(UserRole.PARENT)
  @ApiOperation({ summary: "Parent: read messages in child's conversation" })
  childConversationMessages(
    @Param('studentId', ParseUUIDPipe) studentId: string,
    @Param('convId', ParseUUIDPipe) convId: string,
    @CurrentUser() user: User,
    @Query('limit') limit?: string,
    @Query('skip') skip?: string,
  ) {
    return this.chat.listChildConversationMessages(
      user.id, studentId, convId,
      limit ? parseInt(limit, 10) : 50,
      skip ? parseInt(skip, 10) : 0,
    );
  }

  @Get('messages/:id/read-receipts')
  @ApiOperation({ summary: 'Get read receipts for a message' })
  readReceipts(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: User) {
    return this.chat.getReadReceipts(id, user);
  }

  @Get('users/search')
  @ApiOperation({ summary: 'Search users to initiate a chat' })
  @ApiQuery({ name: 'q', required: false })
  searchUsers(@Query('q') query: string, @CurrentUser() user: User) {
    return this.chat.searchUsers(user, query || '');
  }
}
