import { Body, Controller, Get, Param, ParseUUIDPipe, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsArray, IsBoolean, IsOptional, IsString, IsUUID, MinLength } from 'class-validator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole } from '../users/entities/user.entity';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { User } from '../users/entities/user.entity';
import { ChatService } from './chat.service';

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

  @Get('conversations/:id')
  one(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: User) {
    return this.chat.getConversation(id, user);
  }

  @Get('conversations/:id/messages')
  messages(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: User,
    @Query('limit') limit?: string,
  ) {
    return this.chat.listMessages(id, user, limit ? parseInt(limit, 10) : 50);
  }

  @Post('conversations/:id/messages')
  post(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: MsgDto,
    @CurrentUser() user: User,
  ) {
    return this.chat.postMessage(id, user.id, dto.text);
  }
}
