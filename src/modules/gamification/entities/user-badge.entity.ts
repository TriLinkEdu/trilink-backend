import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, Index, ManyToOne, JoinColumn } from 'typeorm';
import { Badge } from './badge.entity';

@Entity('user_badges')
@Index(['userId', 'badgeId'], { unique: true })
export class UserBadge {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'user_id', type: 'uuid' })
  userId: string;

  @Column({ name: 'badge_id', type: 'uuid' })
  badgeId: string;

  @ManyToOne(() => Badge)
  @JoinColumn({ name: 'badge_id' })
  badge?: Badge;

  @Column({ name: 'awarded_by_id', type: 'uuid', nullable: true })
  awardedById: string | null;

  @Column({ name: 'points_earned', type: 'integer', default: 0 })
  pointsEarned: number;

  @CreateDateColumn({ name: 'awarded_at' })
  awardedAt: Date;
}
