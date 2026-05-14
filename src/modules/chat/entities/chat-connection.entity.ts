import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, CreateDateColumn, UpdateDateColumn, Index } from 'typeorm';
import { User } from '../../users/entities/user.entity';

export enum ConnectionStatus {
  PENDING = 'pending',
  ACCEPTED = 'accepted',
  REJECTED = 'rejected',
}

@Entity('chat_connections')
@Index(['requesterId', 'recipientId'], { unique: true })
export class ChatConnection {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column('uuid')
  requesterId: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  requester: User;

  @Column('uuid')
  recipientId: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  recipient: User;

  @Column({
    type: 'enum',
    enum: ConnectionStatus,
    default: ConnectionStatus.PENDING,
  })
  status: ConnectionStatus;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
