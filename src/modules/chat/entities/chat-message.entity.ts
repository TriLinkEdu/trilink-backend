import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn } from 'typeorm';

@Entity('chat_messages')
export class ChatMessage {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'conversation_id', type: 'uuid' })
  conversationId: string;

  @Column({ name: 'sender_id', type: 'uuid' })
  senderId: string;

  @Column({ type: 'text' })
  text: string;

  @Column({ type: 'varchar', nullable: true, name: 'image_url' })
  imageUrl?: string;

  @Column({ type: 'varchar', default: 'text' })
  type: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
