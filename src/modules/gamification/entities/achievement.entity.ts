import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn } from 'typeorm';

export type AchievementCategory = 'consistency' | 'milestone' | 'exploration' | 'social';

@Entity('achievements')
export class Achievement {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 64, unique: true })
  key: string;

  @Column({ type: 'varchar', length: 120 })
  title: string;

  @Column({ type: 'text', nullable: true })
  description: string | null;

  @Column({ name: 'icon_url', type: 'varchar', length: 255, nullable: true })
  iconUrl: string | null;

  @Column({ type: 'varchar', length: 20 })
  category: AchievementCategory;

  @Column({ name: 'unlock_condition', type: 'jsonb' })
  unlockCondition: Record<string, any>;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
