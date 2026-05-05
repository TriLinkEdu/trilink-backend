import { Entity, Column, PrimaryColumn, UpdateDateColumn } from 'typeorm';

@Entity('conversation_reads')
export class ConversationRead {
  @PrimaryColumn({ name: 'user_id', type: 'uuid' })
  userId: string;

  @PrimaryColumn({ name: 'conversation_id', type: 'uuid' })
  conversationId: string;

  @Column({ name: 'last_read_message_id', type: 'uuid', nullable: true })
  lastReadMessageId: string | null;

  @UpdateDateColumn({ name: 'last_read_at' })
  lastReadAt: Date;
}
