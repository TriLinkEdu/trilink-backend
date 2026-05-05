import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn } from 'typeorm';

@Entity('conversations')
export class Conversation {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 20 })
  type: string;

  @Column({ type: 'varchar', length: 200 })
  title: string;

  @Column({ type: 'text', nullable: true })
  description: string | null;

  @Column({ name: 'class_offering_id', type: 'uuid', nullable: true })
  classOfferingId: string | null;

  @Column({ name: 'parent_visible', type: 'boolean', default: true })
  parentVisible: boolean;

  @Column({ name: 'created_by_id', type: 'uuid' })
  createdById: string;

  @Column({ name: 'last_message_text', type: 'varchar', length: 500, nullable: true })
  lastMessageText: string | null;

  @Column({ name: 'last_message_at', type: 'timestamp', nullable: true })
  lastMessageAt: Date | null;

  @Column({ name: 'last_message_sender_id', type: 'uuid', nullable: true })
  lastMessageSenderId: string | null;

  @Column({ name: 'avatar_file_id', type: 'uuid', nullable: true })
  avatarFileId: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
