import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, Index, ManyToOne, JoinColumn } from 'typeorm';
import { Achievement } from './achievement.entity';

@Entity('user_achievements')
@Index(['userId', 'achievementId'], { unique: true })
export class UserAchievement {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'user_id', type: 'uuid' })
  userId: string;

  @Column({ name: 'achievement_id', type: 'uuid' })
  achievementId: string;

  @ManyToOne(() => Achievement)
  @JoinColumn({ name: 'achievement_id' })
  achievement?: Achievement;

  @CreateDateColumn({ name: 'unlocked_at' })
  unlockedAt: Date;

  @Column({ name: 'progress_data', type: 'jsonb', nullable: true })
  progressData: Record<string, any> | null;
}
