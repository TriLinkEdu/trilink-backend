import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn } from 'typeorm';

@Entity('chat_messages')
export class ChatMessage {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'conversation_id', type: 'uuid' })
  conversationId: string;

  @Column({ name: 'sender_id', type: 'uuid' })
  senderId: string;

  @Column({ type: 'text', nullable: true })
  text: string | null;

  // ── Reply ──────────────────────────────────────────────────────────────────
  @Column({ name: 'reply_to_id', type: 'uuid', nullable: true })
  replyToId: string | null;

  // ── Media ──────────────────────────────────────────────────────────────────
  @Column({ name: 'media_file_id', type: 'uuid', nullable: true })
  mediaFileId: string | null;

  /** 'image' | 'video' | 'audio' | 'file' */
  @Column({ name: 'media_type', type: 'varchar', length: 20, nullable: true })
  mediaType: string | null;

  @Column({ name: 'media_name', type: 'varchar', length: 255, nullable: true })
  mediaName: string | null;

  @Column({ name: 'media_mime_type', type: 'varchar', length: 120, nullable: true })
  mediaMimeType: string | null;

  @Column({ name: 'media_size', type: 'bigint', nullable: true })
  mediaSize: number | null;

  // ── Lifecycle ──────────────────────────────────────────────────────────────
  @Column({ name: 'edited_at', type: 'timestamp', nullable: true })
  editedAt: Date | null;

  @Column({ name: 'deleted_at', type: 'timestamp', nullable: true })
  deletedAt: Date | null;

  // ── Reactions ──────────────────────────────────────────────────────────────
  /** { "👍": ["userId1", "userId2"] } */
  @Column({ type: 'jsonb', nullable: true, default: '{}' })
  reactions: Record<string, string[]> | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
