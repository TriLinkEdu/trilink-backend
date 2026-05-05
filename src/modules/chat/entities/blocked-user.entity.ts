import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, CreateDateColumn, Index } from 'typeorm';
import { User } from '../../users/entities/user.entity';

@Entity('blocked_users')
@Index(['blockerId', 'blockedId'], { unique: true })
export class BlockedUser {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column('uuid')
  blockerId: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  blocker: User;

  @Column('uuid')
  blockedId: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  blocked: User;

  @CreateDateColumn()
  createdAt: Date;
}
